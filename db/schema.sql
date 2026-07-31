-- PR Review Load Balancer Schema
-- Run: psql $DATABASE_URL -f db/schema.sql

BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  github_id     BIGINT UNIQUE NOT NULL,
  username      VARCHAR(255) NOT NULL,
  avatar_url    TEXT,
  access_token  TEXT,            -- encrypted GitHub OAuth token
  team_id       INTEGER,         -- nullable until assigned to a team
  active        BOOLEAN DEFAULT TRUE,  -- false = PTO / out-of-office
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS repos (
  id            SERIAL PRIMARY KEY,
  github_repo_id BIGINT UNIQUE NOT NULL,
  owner         VARCHAR(255) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  team_id       INTEGER REFERENCES users(team_id),
  webhook_active BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pull_requests (
  id            SERIAL PRIMARY KEY,
  github_pr_id  BIGINT NOT NULL,
  repo_id       INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  author_id     INTEGER REFERENCES users(id),
  title         TEXT,
  state         VARCHAR(20) DEFAULT 'open',  -- open, closed, merged
  html_url      TEXT,
  opened_at     TIMESTAMPTZ NOT NULL,
  closed_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(github_pr_id, repo_id)
);

CREATE TABLE IF NOT EXISTS review_assignments (
  id            SERIAL PRIMARY KEY,
  pr_id         INTEGER NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
  reviewer_id   INTEGER NOT NULL REFERENCES users(id),
  assigned_at   TIMESTAMPTZ DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,       -- null = still open
  status        VARCHAR(20) DEFAULT 'pending',  -- pending, approved, changes_requested, commented
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for the hot paths: load queries and webhook lookups
CREATE INDEX IF NOT EXISTS idx_review_assignments_reviewer_status
  ON review_assignments(reviewer_id, status) WHERE completed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pull_requests_state
  ON pull_requests(state) WHERE state = 'open';

CREATE INDEX IF NOT EXISTS idx_pull_requests_github_id
  ON pull_requests(github_pr_id, repo_id);

CREATE INDEX IF NOT EXISTS idx_repos_github_id
  ON repos(github_repo_id);

CREATE INDEX IF NOT EXISTS idx_users_github_id
  ON users(github_id);

-- View: current review load per reviewer (not a table — always computed fresh)
CREATE OR REPLACE VIEW review_load AS
SELECT
  u.id AS reviewer_id,
  u.username,
  u.active,
  COUNT(ra.id) FILTER (WHERE ra.completed_at IS NULL) AS open_review_count,
  COALESCE(
    AVG(EXTRACT(EPOCH FROM (ra.completed_at - ra.assigned_at)) / 3600)
      FILTER (WHERE ra.completed_at IS NOT NULL
              AND ra.assigned_at > NOW() - INTERVAL '30 days'),
    0
  ) AS avg_turnaround_hours
FROM users u
LEFT JOIN review_assignments ra ON ra.reviewer_id = u.id
GROUP BY u.id, u.username, u.active;

-- Session table for connect-pg-simple
CREATE TABLE IF NOT EXISTS "session" (
  "sid"    VARCHAR NOT NULL COLLATE "default",
  "sess"   JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

COMMIT;
