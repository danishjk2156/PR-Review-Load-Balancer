import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAssignments, fetchTeamLoad, reassignPR } from '../api';

export default function PRAssignmentsPage({ user }) {
  const queryClient = useQueryClient();
  const [selectedPr, setSelectedPr] = useState(null);
  const [selectedReviewer, setSelectedReviewer] = useState('');
  const [msg, setMsg] = useState('');

  // Fetch PR assignments
  const { data: assignments, isLoading } = useQuery({
    queryKey: ['assignments'],
    queryFn: fetchAssignments,
    enabled: !!user?.team_id,
    refetchInterval: 30000,
  });

  // Fetch team load for the reviewer dropdown in reassign modal
  const { data: teamLoad } = useQuery({
    queryKey: ['teamLoad'],
    queryFn: fetchTeamLoad,
    enabled: !!user?.team_id,
  });

  const reassignMutation = useMutation({
    mutationFn: ({ prId, reviewerId }) => reassignPR(prId, reviewerId || null),
    onSuccess: (data) => {
      setMsg(`Reassigned to @${data.assigned.username || data.assigned.reviewer}`);
      setSelectedPr(null);
      setSelectedReviewer('');
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['teamLoad'] });
      queryClient.invalidateQueries({ queryKey: ['stuckPRs'] });
    },
    onError: (err) => setMsg(`Error: ${err.message}`),
  });

  const handleReassignSubmit = (e) => {
    e.preventDefault();
    if (!selectedPr) return;
    reassignMutation.mutate({ prId: selectedPr.pr_id, reviewerId: selectedReviewer ? parseInt(selectedReviewer) : null });
  };

  if (!user?.team_id) {
    return (
      <div className="dashboard">
        <div className="alert alert-warning">
          Please join or create a team in <strong>Settings</strong> to view PR assignments.
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>PR Assignments</h1>
      </div>

      {msg && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          {msg}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2>Active & Recent Review Assignments</h2>
        </div>

        {isLoading ? (
          <div style={{ padding: 20 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton skeleton-row" />
            ))}
          </div>
        ) : !assignments || assignments.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
            No PR assignments found for your team yet. Connect a repository and open a PR to get started!
          </div>
        ) : (
          <table className="stuck-table">
            <thead>
              <tr>
                <th>PR Title</th>
                <th>Author</th>
                <th>Assigned Reviewer</th>
                <th>Status</th>
                <th>Hours in Review</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((item) => (
                <tr key={`${item.pr_id}-${item.assigned_at}`}>
                  <td>
                    <a href={item.html_url} target="_blank" rel="noreferrer" className="pr-link">
                      {item.title}
                    </a>
                  </td>
                  <td>@{item.author || 'unknown'}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {item.reviewer_avatar && (
                        <img src={item.reviewer_avatar} alt={item.reviewer} className="user-avatar" style={{ width: 20, height: 20 }} />
                      )}
                      <span>@{item.reviewer}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${
                      item.status === 'approved' ? 'badge-success' :
                      item.status === 'pending' ? 'badge-warning' :
                      item.status === 'reassigned' ? 'badge-primary' : 'badge-danger'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td>{Math.round(item.hours_in_review || 0)}h</td>
                  <td>
                    {item.completed_at === null ? (
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => { setSelectedPr(item); setSelectedReviewer(''); setMsg(''); }}
                      >
                        Reassign
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Completed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Reassign Modal */}
      {selectedPr && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: 450, padding: 24 }}>
            <h3>Reassign PR #{selectedPr.pr_id}</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '8px 0 16px' }}>
              {selectedPr.title}
            </p>

            <form onSubmit={handleReassignSubmit}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem' }}>Select New Reviewer</label>
                <select
                  className="form-input"
                  value={selectedReviewer}
                  onChange={(e) => setSelectedReviewer(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">⚡ Auto-assign (Least Loaded)</option>
                  {teamLoad?.map((m) => (
                    <option key={m.reviewer_id} value={m.reviewer_id}>
                      @{m.username} (Open PRs: {m.open_reviews}, Score: {m.load_score})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedPr(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={reassignMutation.isPending}>
                  {reassignMutation.isPending ? 'Reassigning...' : 'Confirm Reassign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
