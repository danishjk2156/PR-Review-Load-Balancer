const db = require('../../db');
const fs = require('fs');
const path = require('path');
const { Octokit } = require('octokit');
const config = require('../config');

const loadRankingSQL = fs.readFileSync(
  path.join(__dirname, '../../db/queries/load-ranking.sql'),
  'utf8'
);

/**
 * Assign the least-loaded eligible reviewer to a PR.
 * 1. Run load-ranking query to get ranked team members
 * 2. Pick rank=1 (lowest load score)
 * 3. Insert review_assignments row
 * 4. Call GitHub API to request that review
 *
 * Returns the assigned reviewer or null if no eligible reviewer found.
 */
async function assignReviewer(prId, authorId, teamId, repoOwner, repoName, prNumber) {
  // Get ranked reviewers
  const { rows } = await db.query(loadRankingSQL, [authorId, teamId]);

  if (rows.length === 0) {
    console.warn(`No eligible reviewers for PR #${prNumber} (team_id=${teamId})`);
    return null;
  }

  const reviewer = rows[0]; // rank=1, lowest load

  // Record the assignment
  await db.query(
    `INSERT INTO review_assignments (pr_id, reviewer_id, status)
     VALUES ($1, $2, 'pending')`,
    [prId, reviewer.reviewer_id]
  );

  // Request review via GitHub API
  if (config.github.token) {
    try {
      const octokit = new Octokit({ auth: config.github.token });
      await octokit.rest.pulls.requestReviewers({
        owner: repoOwner,
        repo: repoName,
        pull_number: prNumber,
        reviewers: [reviewer.username],
      });
    } catch (err) {
      // Log but don't fail — the assignment is still recorded locally
      console.error(`GitHub API error requesting review from ${reviewer.username}:`, err.message);
    }
  }

  console.log(`Assigned ${reviewer.username} to PR #${prNumber} (load_score=${reviewer.load_score})`);
  return reviewer;
}

module.exports = { assignReviewer };
