function formatHours(hours) {
  const h = Number(hours);
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

function urgencyBadge(hours) {
  const h = Number(hours);
  if (h > 96) return <span className="badge badge-red">Critical</span>;
  if (h > 72) return <span className="badge badge-yellow">Overdue</span>;
  return <span className="badge badge-yellow">Stale</span>;
}

export default function StuckTable({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h2>Stuck PRs (&gt;48h No Review)</h2>
        </div>
        <div className="empty-state">
          <p>🎉 No stuck PRs — all reviews are on track!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>Stuck PRs (&gt;48h No Review)</h2>
        <span className="badge badge-red">{data.length} stuck</span>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Pull Request</th>
              <th>Author</th>
              <th>Open For</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((pr) => (
              <tr key={pr.id}>
                <td>
                  <a href={pr.html_url} target="_blank" rel="noopener noreferrer" className="pr-link">
                    {pr.title}
                  </a>
                </td>
                <td>{pr.author}</td>
                <td>{formatHours(pr.hours_open)}</td>
                <td>{urgencyBadge(pr.hours_open)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
