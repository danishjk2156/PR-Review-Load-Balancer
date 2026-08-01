const API_BASE = '';

async function fetchJSON(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });
  if (res.status === 401) return null;
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${res.status}`);
  }
  return res.json();
}

export function fetchCurrentUser() {
  return fetchJSON('/auth/me');
}

export function fetchTeamLoad() {
  return fetchJSON('/api/team/load');
}

export function fetchStuckPRs() {
  return fetchJSON('/api/team/stuck');
}

export function createTeam(data) {
  return fetchJSON('/api/teams', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function fetchTeam(teamId) {
  return fetchJSON(`/api/teams/${teamId}`);
}

export function addTeamMember(teamId, githubUsername) {
  return fetchJSON(`/api/teams/${teamId}/members`, {
    method: 'POST',
    body: JSON.stringify({ githubUsername }),
  });
}

export function removeTeamMember(teamId, userId) {
  return fetchJSON(`/api/teams/${teamId}/members/${userId}`, {
    method: 'DELETE',
  });
}

export function attachRepo(teamId, { owner, repoName }) {
  return fetchJSON(`/api/teams/${teamId}/repos`, {
    method: 'POST',
    body: JSON.stringify({ owner, repoName }),
  });
}

export function fetchAssignments() {
  return fetchJSON('/api/assignments');
}

export function reassignPR(prId, reviewerId) {
  return fetchJSON(`/api/assignments/${prId}/reassign`, {
    method: 'POST',
    body: JSON.stringify({ reviewerId }),
  });
}

export async function logout() {
  await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
}
