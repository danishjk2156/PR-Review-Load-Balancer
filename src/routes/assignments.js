const router = require('express').Router();
const db = require('../../db');
const { requireAuth } = require('../middleware/auth');
const { assignReviewer } = require('../services/assignment');

/**
 * @swagger
 * /api/assignments/{prId}/reassign:
 *   post:
 *     summary: Manually reassign a PR to a different reviewer
 *     tags: [Assignments]
 */
router.post('/:prId/reassign', requireAuth, async (req, res) => {
  const { prId } = req.params;
  const { reviewerId } = req.body; // optional — if omitted, auto-picks least-loaded

  try {
    // Look up the PR
    const prResult = await db.query(
      `SELECT pr.id, pr.author_id, pr.github_pr_id, r.owner, r.name AS repo_name, r.team_id
       FROM pull_requests pr
       JOIN repos r ON r.id = pr.repo_id
       WHERE pr.id = $1 AND pr.state = 'open'`,
      [prId]
    );

    if (prResult.rows.length === 0) {
      return res.status(404).json({ error: 'Open PR not found' });
    }

    const pr = prResult.rows[0];

    if (!pr.team_id) {
      return res.status(400).json({ error: 'PR repo is not attached to a team' });
    }

    // Cancel current pending assignment(s) for this PR
    await db.query(
      `UPDATE review_assignments
       SET completed_at = NOW(), status = 'reassigned'
       WHERE pr_id = $1 AND completed_at IS NULL`,
      [prId]
    );

    if (reviewerId) {
      // Manual pick — verify the reviewer is on the same team
      const reviewer = await db.query(
        'SELECT id, username FROM users WHERE id = $1 AND team_id = $2 AND active = TRUE',
        [reviewerId, pr.team_id]
      );

      if (reviewer.rows.length === 0) {
        return res.status(400).json({ error: 'Reviewer not found, not on this team, or inactive' });
      }

      await db.query(
        `INSERT INTO review_assignments (pr_id, reviewer_id, status) VALUES ($1, $2, 'pending')`,
        [prId, reviewerId]
      );

      console.log(`Manual reassign: PR #${pr.github_pr_id} → ${reviewer.rows[0].username}`);
      return res.json({ assigned: reviewer.rows[0] });
    }

    // Auto-pick: use the load balancer
    const assigned = await assignReviewer(
      parseInt(prId), pr.author_id, pr.team_id, pr.owner, pr.repo_name, pr.github_pr_id
    );

    if (!assigned) {
      return res.status(422).json({ error: 'No eligible reviewers available' });
    }

    res.json({ assigned });
  } catch (err) {
    console.error('Reassign error:', err);
    res.status(500).json({ error: 'Failed to reassign PR' });
  }
});

/**
 * @swagger
 * /api/assignments:
 *   get:
 *     summary: List PR assignments for the current user's team
 *     tags: [Assignments]
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    if (!req.user.team_id) return res.json([]);

    const result = await db.query(`
      SELECT
        pr.id AS pr_id,
        pr.title,
        pr.html_url,
        pr.state,
        pr.opened_at,
        author.username AS author,
        reviewer.username AS reviewer,
        reviewer.avatar_url AS reviewer_avatar,
        ra.status,
        ra.assigned_at,
        ra.completed_at,
        EXTRACT(EPOCH FROM (COALESCE(ra.completed_at, NOW()) - ra.assigned_at)) / 3600 AS hours_in_review
      FROM review_assignments ra
      JOIN pull_requests pr ON pr.id = ra.pr_id
      JOIN repos r ON r.id = pr.repo_id
      JOIN users reviewer ON reviewer.id = ra.reviewer_id
      LEFT JOIN users author ON author.id = pr.author_id
      WHERE r.team_id = $1
      ORDER BY ra.assigned_at DESC
      LIMIT 100
    `, [req.user.team_id]);

    res.json(result.rows);
  } catch (err) {
    console.error('List assignments error:', err);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

module.exports = router;
