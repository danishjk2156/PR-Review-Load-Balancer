export default function StatsRow({ loadData, stuckData }) {
  const totalReviewers = loadData?.length ?? 0;
  const totalOpenReviews = loadData?.reduce((sum, r) => sum + Number(r.open_review_count), 0) ?? 0;
  const stuckCount = stuckData?.length ?? 0;

  const avgLoadScore = totalReviewers > 0
    ? (loadData.reduce((sum, r) => sum + Number(r.load_score), 0) / totalReviewers).toFixed(1)
    : '—';

  return (
    <div className="stats-row">
      <div className="card stat-card">
        <div className="stat-label">Active Reviewers</div>
        <div className="stat-value stat-green">{totalReviewers}</div>
      </div>
      <div className="card stat-card">
        <div className="stat-label">Open Reviews</div>
        <div className="stat-value" style={{ color: 'var(--accent)' }}>{totalOpenReviews}</div>
      </div>
      <div className="card stat-card">
        <div className="stat-label">Avg Load Score</div>
        <div className="stat-value stat-yellow">{avgLoadScore}</div>
      </div>
      <div className="card stat-card">
        <div className="stat-label">Stuck PRs</div>
        <div className={`stat-value ${stuckCount > 0 ? 'stat-red' : 'stat-green'}`}>
          {stuckCount}
        </div>
      </div>
    </div>
  );
}
