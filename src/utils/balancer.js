/**
 * Load score formula: (open_review_count * 2) + avg_turnaround_hours
 */
function calculateLoadScore(openReviewCount, avgTurnaroundHours) {
  return (openReviewCount * 2) + (parseFloat(avgTurnaroundHours) || 0);
}

/**
 * Pure algorithm function to rank candidate reviewers.
 * Mirrors the load-ranking SQL window function logic with deterministic tie-breaking.
 * Tie-breaking priority:
 *   1. Load Score ASC
 *   2. Open Review Count ASC (fewer active reviews first)
 *   3. User ID ASC
 */
function rankReviewers(candidates, authorId) {
  return candidates
    .filter(r => r.active && r.id !== authorId)
    .map(r => ({
      ...r,
      load_score: calculateLoadScore(r.open_review_count, r.avg_turnaround_hours),
    }))
    .sort((a, b) =>
      a.load_score - b.load_score ||
      a.open_review_count - b.open_review_count ||
      a.id - b.id
    )
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

module.exports = { calculateLoadScore, rankReviewers };
