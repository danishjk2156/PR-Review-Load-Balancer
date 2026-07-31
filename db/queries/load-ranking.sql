-- Load-Ranking Query
-- Returns team members ranked by current review burden.
-- Used by the assignment engine to pick the least-loaded eligible reviewer.
--
-- Ranking formula: (open_reviews * 2) + avg_turnaround_hours
--   - open_reviews weighted 2x because immediate capacity matters more
--   - avg_turnaround penalizes slow reviewers slightly
--
-- Filters:
--   - Must be active (not PTO/out-of-office)
--   - Must not be the PR author (can't review your own PR)
--   - Must be on the same team

SELECT
  reviewer_id,
  username,
  open_review_count,
  ROUND(avg_turnaround_hours::NUMERIC, 1) AS avg_turnaround_hours,
  (open_review_count * 2) + avg_turnaround_hours AS load_score,
  RANK() OVER (
    ORDER BY (open_review_count * 2) + avg_turnaround_hours ASC
  ) AS rank
FROM review_load
WHERE active = TRUE
  AND reviewer_id != $1   -- exclude PR author
  AND reviewer_id IN (     -- same team only
    SELECT id FROM users WHERE team_id = $2
  )
ORDER BY rank ASC;
