import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const BAR_COLORS = ['#58a6ff', '#bc8cff', '#3fb950', '#d29922', '#f85149', '#79c0ff', '#a5d6ff'];

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: '#1c2128',
      border: '1px solid #30363d',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: '0.85rem',
      color: '#e6edf3',
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    }}>
      <strong>{d.username}</strong>
      <div style={{ color: '#8b949e', marginTop: 4 }}>
        Open Reviews: {d.open_review_count}<br />
        Avg Turnaround: {d.avg_turnaround_hours}h<br />
        Load Score: {Number(d.load_score).toFixed(1)}<br />
        Rank: #{d.rank}
      </div>
    </div>
  );
}

export default function LoadChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h2>Team Reviewer Load</h2>
        </div>
        <div className="empty-state">
          <p>No team load data yet. Add team members and review some PRs to see the chart.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>Team Reviewer Load</h2>
        <span className="badge badge-green">Rank #1 = Next Assignee</span>
      </div>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
            <XAxis dataKey="username" stroke="#8b949e" fontSize={13} />
            <YAxis stroke="#8b949e" fontSize={12} label={{ value: 'Load Score', angle: -90, position: 'insideLeft', fill: '#656d76', fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(88,166,255,0.08)' }} />
            <Bar dataKey="load_score" radius={[6, 6, 0, 0]} maxBarSize={60}>
              {data.map((_, i) => (
                <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
