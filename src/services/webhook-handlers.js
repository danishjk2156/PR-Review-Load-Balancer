const db = require('../../db');
const { assignReviewer } = require('./assignment');

/**
 * Handle pull_request.opened webhook event.
 * 1. Upsert the repo if we haven't seen it
 * 2. Insert the PR record
 * 3. Trigger reviewer assignment
 */
async function handlePROpened(payload) {
  const { pull_request: pr, repository: repo } = payload;

  // Upsert repo
  const repoResult = await db.query(
    `INSERT INTO repos (github_repo_id, owner, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (github_repo_id) DO UPDATE SET name = $3
     RETURNING id, team_id`,
    [repo.id, repo.owner.login, repo.name]
  );
  const repoRow = repoResult.rows[0];

  // Find or skip author — they may not be in our system
  const authorResult = await db.query(
    'SELECT id, team_id FROM users WHERE github_id = $1',
    [pr.user.id]
  );
  const author = authorResult.rows[0];

  // Insert PR
  const prResult = await db.query(
    `INSERT INTO pull_requests (github_pr_id, repo_id, author_id, title, state, html_url, opened_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (github_pr_id, repo_id) DO NOTHING
     RETURNING id`,
    [pr.number, repoRow.id, author?.id || null, pr.title, 'open', pr.html_url, pr.created_at]
  );

  if (prResult.rows.length === 0) return; // duplicate event

  const prId = prResult.rows[0].id;
  const teamId = author?.team_id || repoRow.team_id;

  // Only assign if we know which team to draw from
  if (teamId && author) {
    await assignReviewer(prId, author.id, teamId, repo.owner.login, repo.name, pr.number);
  }
}

/**
 * Handle pull_request_review.submitted webhook event.
 * Updates the review assignment status and completion time.
 */
async function handleReviewSubmitted(payload) {
  const { review, pull_request: pr, repository: repo } = payload;

  // Find the reviewer in our system
  const reviewerResult = await db.query(
    'SELECT id FROM users WHERE github_id = $1',
    [review.user.id]
  );
  if (reviewerResult.rows.length === 0) return; // reviewer not in our system

  const reviewerId = reviewerResult.rows[0].id;

  // Find the PR
  const repoResult = await db.query(
    'SELECT id FROM repos WHERE github_repo_id = $1',
    [repo.id]
  );
  if (repoResult.rows.length === 0) return;

  const prResult = await db.query(
    'SELECT id FROM pull_requests WHERE github_pr_id = $1 AND repo_id = $2',
    [pr.number, repoResult.rows[0].id]
  );
  if (prResult.rows.length === 0) return;

  // Map GitHub review state to our status
  const statusMap = {
    approved: 'approved',
    changes_requested: 'changes_requested',
    commented: 'commented',
  };
  const status = statusMap[review.state] || 'commented';

  // Update the assignment — mark complete
  await db.query(
    `UPDATE review_assignments
     SET completed_at = NOW(), status = $1
     WHERE pr_id = $2 AND reviewer_id = $3 AND completed_at IS NULL`,
    [status, prResult.rows[0].id, reviewerId]
  );
}

module.exports = { handlePROpened, handleReviewSubmitted };
