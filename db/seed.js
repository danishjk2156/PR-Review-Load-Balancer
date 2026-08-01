require('dotenv').config();
const { Pool } = require('pg');

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is missing in .env');
    process.exit(1);
  }

  console.log('🌱 Seeding PostgreSQL database with sample team data...');
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // 1. Create Team #1
    await pool.query(
      `INSERT INTO teams (id, name) VALUES (1, 'Core Platform Team')
       ON CONFLICT DO NOTHING`
    );

    // 2. Create Users
    const users = [
      [101, 'alice-dev', 'https://avatars.githubusercontent.com/u/101?v=4', 1, true],
      [102, 'bob-engineer', 'https://avatars.githubusercontent.com/u/102?v=4', 1, true],
      [103, 'charlie-lead', 'https://avatars.githubusercontent.com/u/103?v=4', 1, true],
      [104, 'dana-pto', 'https://avatars.githubusercontent.com/u/104?v=4', 1, false], // Out of Office
    ];

    for (const [ghId, username, avatar, teamId, active] of users) {
      await pool.query(
        `INSERT INTO users (github_id, username, avatar_url, team_id, active)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (github_id)
         DO UPDATE SET team_id = $4, active = $5`,
        [ghId, username, avatar, teamId, active]
      );
    }

    // 3. Create Repo
    const repoRes = await pool.query(
      `INSERT INTO repos (github_repo_id, owner, name, team_id)
       VALUES (99991, 'acme-corp', 'api-service', 1)
       ON CONFLICT (github_repo_id) DO UPDATE SET team_id = 1
       RETURNING id`
    );
    const repoId = repoRes.rows[0].id;

    // 4. Create PRs & Assignments
    // Get user IDs
    const alice = (await pool.query(`SELECT id FROM users WHERE username = 'alice-dev'`)).rows[0].id;
    const bob = (await pool.query(`SELECT id FROM users WHERE username = 'bob-engineer'`)).rows[0].id;
    const charlie = (await pool.query(`SELECT id FROM users WHERE username = 'charlie-lead'`)).rows[0].id;

    // PR 1 (Recent)
    const pr1 = await pool.query(
      `INSERT INTO pull_requests (github_pr_id, repo_id, author_id, title, state, html_url, opened_at)
       VALUES (1, $1, $2, 'feat: Add user authentication endpoints', 'open', 'https://github.com/acme-corp/api-service/pull/1', NOW() - INTERVAL '2 hours')
       ON CONFLICT (github_pr_id, repo_id) DO UPDATE SET title = EXCLUDED.title
       RETURNING id`,
      [repoId, alice]
    );

    // PR 2 (Stuck > 48h)
    const pr2 = await pool.query(
      `INSERT INTO pull_requests (github_pr_id, repo_id, author_id, title, state, html_url, opened_at)
       VALUES (2, $1, $2, 'refactor: Database connection pool optimization', 'open', 'https://github.com/acme-corp/api-service/pull/2', NOW() - INTERVAL '60 hours')
       ON CONFLICT (github_pr_id, repo_id) DO UPDATE SET title = EXCLUDED.title
       RETURNING id`,
      [repoId, bob]
    );

    // Review Assignments:
    // Bob has 2 open reviews
    await pool.query(
      `INSERT INTO review_assignments (pr_id, reviewer_id, status)
       VALUES ($1, $2, 'pending')`,
      [pr1.rows[0].id, bob]
    );

    // Charlie has 1 completed review and 1 open
    await pool.query(
      `INSERT INTO review_assignments (pr_id, reviewer_id, status, completed_at)
       VALUES ($1, $2, 'approved', NOW() - INTERVAL '1 hour')`,
      [pr1.rows[0].id, charlie]
    );

    console.log('✅ Success! Seed data populated.');
    console.log('   - Team: Core Platform Team (id: 1)');
    console.log('   - Members: alice-dev, bob-engineer, charlie-lead, dana-pto');
    console.log('   - Repositories & PRs loaded with active workloads!');

  } catch (err) {
    console.error('❌ Seeding error:', err.message);
  } finally {
    await pool.end();
  }
}

seed();
