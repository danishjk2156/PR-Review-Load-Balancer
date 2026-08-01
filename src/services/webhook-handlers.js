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
  if (!author) {
    console.warn(`⚠️ PR #${pr.number} author @${pr.user.login} (github_id: ${pr.user.id}) is not in database. Sign in via GitHub OAuth first.`);
    return;
  }

  if (!author.team_id) {
    console.warn(`⚠️ User @${pr.user.login} is not assigned to any team (team_id is NULL). Assign a team_id to start balancing reviews.`);
    return;
  }

  await assignReviewer(prId, author.id, author.team_id, repo.owner.login, repo.name, pr.number);
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

/**
 * Handle pull_request.closed webhook event.
 * 1. Update PR state to closed/merged
 * 2. Complete any pending review assignments (prevents phantom load)
 */
async function handlePRClosed(payload) {
  const { pull_request: pr, repository: repo } = payload;

  // Find the repo
  const repoResult = await db.query(
    'SELECT id FROM repos WHERE github_repo_id = $1',
    [repo.id]
  );
  if (repoResult.rows.length === 0) return;

  const repoId = repoResult.rows[0].id;
  const newState = pr.merged ? 'merged' : 'closed';

  // Update PR state
  const prResult = await db.query(
    `UPDATE pull_requests
     SET state = $1, closed_at = $2
     WHERE github_pr_id = $3 AND repo_id = $4
     RETURNING id`,
    [newState, pr.closed_at || new Date().toISOString(), pr.number, repoId]
  );

  if (prResult.rows.length === 0) return;

  const prId = prResult.rows[0].id;

  // Complete any pending review assignments so reviewer load doesn't stay inflated
  await db.query(
    `UPDATE review_assignments
     SET completed_at = NOW(), status = $1
     WHERE pr_id = $2 AND completed_at IS NULL`,
    [newState === 'merged' ? 'merged' : 'closed', prId]
  );

  console.log(`PR #${pr.number} ${newState} — cleared ${prResult.rowCount || 0} pending assignments`);
}

module.exports = { handlePROpened, handleReviewSubmitted, handlePRClosed };
