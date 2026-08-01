import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTeam, createTeam, addTeamMember, removeTeamMember, attachRepo } from '../api';

export default function SettingsPage({ user, onTeamUpdated }) {
  const queryClient = useQueryClient();

  // Local state for forms
  const [teamName, setTeamName] = useState('');
  const [githubOrg, setGithubOrg] = useState('');
  const [newMemberUsername, setNewMemberUsername] = useState('');
  const [repoOwner, setRepoOwner] = useState('');
  const [repoName, setRepoName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const teamId = user?.team_id;

  // Fetch team details if teamId exists
  const { data: team, isLoading } = useQuery({
    queryKey: ['teamDetails', teamId],
    queryFn: () => fetchTeam(teamId),
    enabled: !!teamId,
  });

  // Mutations
  const createTeamMutation = useMutation({
    mutationFn: createTeam,
    onSuccess: (newTeam) => {
      setSuccessMsg('Team created successfully!');
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      if (onTeamUpdated) onTeamUpdated(newTeam.id);
    },
    onError: (err) => setErrorMsg(err.message),
  });

  const addMemberMutation = useMutation({
    mutationFn: (username) => addTeamMember(teamId, username),
    onSuccess: () => {
      setNewMemberUsername('');
      setSuccessMsg('Member added successfully!');
      queryClient.invalidateQueries({ queryKey: ['teamDetails', teamId] });
      queryClient.invalidateQueries({ queryKey: ['teamLoad'] });
    },
    onError: (err) => setErrorMsg(err.message),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId) => removeTeamMember(teamId, userId),
    onSuccess: () => {
      setSuccessMsg('Member removed successfully.');
      queryClient.invalidateQueries({ queryKey: ['teamDetails', teamId] });
      queryClient.invalidateQueries({ queryKey: ['teamLoad'] });
    },
    onError: (err) => setErrorMsg(err.message),
  });

  const attachRepoMutation = useMutation({
    mutationFn: (repoData) => attachRepo(teamId, repoData),
    onSuccess: () => {
      setRepoOwner('');
      setRepoName('');
      setSuccessMsg('Repository attached successfully!');
      queryClient.invalidateQueries({ queryKey: ['teamDetails', teamId] });
    },
    onError: (err) => setErrorMsg(err.message),
  });

  const handleCreateTeam = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    createTeamMutation.mutate({ name: teamName, githubOrg });
  };

  const handleAddMember = (e) => {
    e.preventDefault();
    if (!newMemberUsername.trim()) return;
    setErrorMsg('');
    setSuccessMsg('');
    addMemberMutation.mutate(newMemberUsername.trim());
  };

  const handleAttachRepo = (e) => {
    e.preventDefault();
    if (!repoOwner.trim() || !repoName.trim()) return;
    setErrorMsg('');
    setSuccessMsg('');
    attachRepoMutation.mutate({ owner: repoOwner.trim(), repoName: repoName.trim() });
  };

  if (!teamId) {
    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <h1>Team Settings</h1>
        </div>

        {errorMsg && <div className="alert alert-error">{errorMsg}</div>}
        {successMsg && <div className="alert alert-success">{successMsg}</div>}

        <div className="card" style={{ maxWidth: 600, margin: '20px auto' }}>
          <div className="card-header">
            <h2>Create a New Team</h2>
          </div>
          <form onSubmit={handleCreateTeam} className="settings-form">
            <div className="form-group">
              <label>Team Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Core Engineering"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>GitHub Organization (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. acme-corp"
                value={githubOrg}
                onChange={(e) => setGithubOrg(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={createTeamMutation.isPending}>
              {createTeamMutation.isPending ? 'Creating...' : 'Create Team'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="dashboard">
        <div className="skeleton" style={{ width: 200, height: 32 }} />
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Team Settings: {team?.name}</h1>
        {team?.github_org && <span className="badge badge-primary">Org: {team.github_org}</span>}
      </div>

      {errorMsg && <div className="alert alert-error" style={{ marginBottom: 16 }}>{errorMsg}</div>}
      {successMsg && <div className="alert alert-success" style={{ marginBottom: 16 }}>{successMsg}</div>}

      <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Members Section */}
        <div className="card">
          <div className="card-header">
            <h2>Team Members ({team?.members?.length || 0})</h2>
          </div>

          <form onSubmit={handleAddMember} style={{ display: 'flex', gap: 8, padding: 16, borderBottom: '1px solid var(--border)' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Add by GitHub username..."
              value={newMemberUsername}
              onChange={(e) => setNewMemberUsername(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={addMemberMutation.isPending}>
              {addMemberMutation.isPending ? 'Adding...' : 'Add'}
            </button>
          </form>

          <ul className="member-list" style={{ listStyle: 'none', padding: 0 }}>
            {team?.members?.map((member) => (
              <li key={member.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img src={member.avatar_url || 'https://github.com/identicons/user.png'} alt={member.username} className="user-avatar" />
                  <div>
                    <div style={{ fontWeight: 600 }}>@{member.username}</div>
                    <span className={`badge ${member.active ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.7rem' }}>
                      {member.active ? 'Active' : 'PTO'}
                    </span>
                  </div>
                </div>
                {member.id !== user.id && (
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => removeMemberMutation.mutate(member.id)}
                    disabled={removeMemberMutation.isPending}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Repositories Section */}
        <div className="card">
          <div className="card-header">
            <h2>Attached Repositories ({team?.repos?.length || 0})</h2>
          </div>

          <form onSubmit={handleAttachRepo} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16, borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Owner (e.g. octocat)"
                value={repoOwner}
                onChange={(e) => setRepoOwner(e.target.value)}
              />
              <input
                type="text"
                className="form-input"
                placeholder="Repo Name (e.g. Hello-World)"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end' }} disabled={attachRepoMutation.isPending}>
              {attachRepoMutation.isPending ? 'Attaching...' : 'Attach Repo'}
            </button>
          </form>

          <ul className="repo-list" style={{ listStyle: 'none', padding: 0 }}>
            {team?.repos?.length === 0 ? (
              <li style={{ padding: 16, color: 'var(--text-muted)', textAlign: 'center' }}>No repositories attached yet.</li>
            ) : (
              team?.repos?.map((repo) => (
                <li key={repo.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{repo.owner}/{repo.name}</div>
                  </div>
                  <span className="badge badge-primary">Active</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
