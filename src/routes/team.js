const router = require('express').Router();
const db = require('../../db');
const { requireAuth } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

// Load the ranking query from SQL file
const loadRankingSQL = fs.readFileSync(
  path.join(__dirname, '../../db/queries/load-ranking.sql'),
  'utf8'
);

// GET /api/team/load — ranked reviewer load for the current user's team
router.get('/load', requireAuth, async (req, res) => {
  try {
    if (!req.user.team_id) return res.json([]);
    const result = await db.query(loadRankingSQL, [req.user.id, req.user.team_id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Load query error:', err);
    res.status(500).json({ error: 'Failed to fetch team load' });
  }
});

// GET /api/team/stuck — PRs open >48h with no completed review
router.get('/stuck', requireAuth, async (req, res) => {
  try {
    if (!req.user.team_id) return res.json([]);
    const result = await db.query(`
      SELECT
        pr.id,
        pr.title,
        pr.html_url,
        pr.opened_at,
        EXTRACT(EPOCH FROM (NOW() - pr.opened_at)) / 3600 AS hours_open,
        u.username AS author
      FROM pull_requests pr
      JOIN repos r ON r.id = pr.repo_id
      JOIN users u ON u.id = pr.author_id
      LEFT JOIN review_assignments ra
        ON ra.pr_id = pr.id AND ra.completed_at IS NOT NULL
      WHERE pr.state = 'open'
        AND pr.opened_at < NOW() - INTERVAL '48 hours'
        AND ra.id IS NULL
        AND r.team_id = $1
      ORDER BY pr.opened_at ASC
    `, [req.user.team_id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Stuck PRs query error:', err);
    res.status(500).json({ error: 'Failed to fetch stuck PRs' });
  }
});

module.exports = router;
