const router = require('express').Router();
const db = require('../../db');
const { Octokit } = require('octokit');
const config = require('../config');
const { requireAuth } = require('../middleware/auth');

/**
 * @swagger
 * /api/teams:
 *   post:
 *     summary: Create a new team
 *     tags: [Teams]
 */
router.post('/', requireAuth, async (req, res) => {
  const { name, githubOrg } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Team name is required' });
  }

  try {
    const team = await db.query(
      'INSERT INTO teams (name, github_org, created_by) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), githubOrg || null, req.user.id]
    );

    // Creator becomes first team member automatically
    await db.query('UPDATE users SET team_id = $1 WHERE id = $2', [team.rows[0].id, req.user.id]);

    res.status(201).json(team.rows[0]);
  } catch (err) {
    console.error('Create team error:', err);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

/**
 * @swagger
 * /api/teams/{id}:
 *   get:
 *     summary: Get team details and members
 *     tags: [Teams]
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const team = await db.query('SELECT * FROM teams WHERE id = $1', [req.params.id]);
    if (team.rows.length === 0) return res.status(404).json({ error: 'Team not found' });

    const members = await db.query(
      'SELECT id, username, avatar_url, active FROM users WHERE team_id = $1 ORDER BY username',
      [req.params.id]
    );

    const repos = await db.query(
      'SELECT id, owner, name, webhook_active FROM repos WHERE team_id = $1 ORDER BY name',
      [req.params.id]
    );

    res.json({ ...team.rows[0], members: members.rows, repos: repos.rows });
  } catch (err) {
    console.error('Get team error:', err);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

/**
 * @swagger
 * /api/teams/{id}/members:
 *   post:
 *     summary: Add a member to the team by GitHub username
 *     tags: [Teams]
 */
router.post('/:id/members', requireAuth, async (req, res) => {
  const { githubUsername } = req.body;
  if (!githubUsername || !githubUsername.trim()) {
    return res.status(400).json({ error: 'GitHub username is required' });
  }

  try {
    // Check team exists
    const team = await db.query('SELECT id FROM teams WHERE id = $1', [req.params.id]);
    if (team.rows.length === 0) return res.status(404).json({ error: 'Team not found' });

    // Fetch user info from GitHub API
    let ghUser;
    if (config.github.token) {
      const octokit = new Octokit({ auth: config.github.token });
      const { data } = await octokit.rest.users.getByUsername({ username: githubUsername.trim() });
      ghUser = data;
    } else {
      return res.status(500).json({ error: 'GitHub token not configured — cannot look up users' });
    }

    // Find or create user in our DB
    const existingUser = await db.query('SELECT id FROM users WHERE github_id = $1', [ghUser.id]);

    let userId;
    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id;
      await db.query('UPDATE users SET team_id = $1, username = $2, avatar_url = $3 WHERE id = $4', [
        req.params.id, ghUser.login, ghUser.avatar_url, userId,
      ]);
    } else {
      const newUser = await db.query(
        'INSERT INTO users (github_id, username, avatar_url, team_id) VALUES ($1, $2, $3, $4) RETURNING id',
        [ghUser.id, ghUser.login, ghUser.avatar_url, req.params.id]
      );
      userId = newUser.rows[0].id;
    }

    res.status(201).json({ id: userId, username: ghUser.login, avatar_url: ghUser.avatar_url });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ error: `GitHub user '${req.body.githubUsername}' not found` });
    }
    console.error('Add member error:', err);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

/**
 * @swagger
 * /api/teams/{id}/members/{userId}:
 *   delete:
 *     summary: Remove a member from the team (preserves review history)
 *     tags: [Teams]
 */
router.delete('/:id/members/:userId', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'UPDATE users SET team_id = NULL WHERE id = $1 AND team_id = $2 RETURNING id, username',
      [req.params.userId, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found in this team' });
    }

    res.json({ message: `Removed ${result.rows[0].username} from team`, user: result.rows[0] });
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

/**
 * @swagger
 * /api/teams/{id}/repos:
 *   post:
 *     summary: Attach a GitHub repo to the team
 *     tags: [Teams]
 */
router.post('/:id/repos', requireAuth, async (req, res) => {
  const { owner, repoName } = req.body;
  if (!owner || !repoName) {
    return res.status(400).json({ error: 'owner and repoName are required' });
  }

  try {
    // Check team exists
    const team = await db.query('SELECT id FROM teams WHERE id = $1', [req.params.id]);
    if (team.rows.length === 0) return res.status(404).json({ error: 'Team not found' });

    // Fetch repo info from GitHub
    let ghRepo;
    if (config.github.token) {
      const octokit = new Octokit({ auth: config.github.token });
      const { data } = await octokit.rest.repos.get({ owner, repo: repoName });
      ghRepo = data;
    } else {
      return res.status(500).json({ error: 'GitHub token not configured' });
    }

    // Upsert repo record and attach to team
    const result = await db.query(
      `INSERT INTO repos (github_repo_id, owner, name, team_id, webhook_active)
       VALUES ($1, $2, $3, $4, FALSE)
       ON CONFLICT (github_repo_id)
       DO UPDATE SET team_id = $4, name = $3
       RETURNING *`,
      [ghRepo.id, owner, repoName, req.params.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ error: `Repository '${owner}/${repoName}' not found` });
    }
    console.error('Add repo error:', err);
    res.status(500).json({ error: 'Failed to attach repo' });
  }
});

module.exports = router;
