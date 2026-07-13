import { authFetch } from './auth';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export async function fetchServers() {
  const res = await authFetch(`${BACKEND_URL}/api/v1/servers`);
  if (!res || !res.ok) throw new Error('Failed to fetch servers');
  return res.json();
}

export async function createServer(name) {
  const res = await authFetch(`${BACKEND_URL}/api/v1/servers`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  if (!res || !res.ok) throw new Error('Failed to create server');
  return res.json();
}

export async function deleteServer(id) {
  const res = await authFetch(`${BACKEND_URL}/api/v1/servers/${id}`, {
    method: 'DELETE',
  });
  if (!res || !res.ok) throw new Error('Failed to delete server');
  return res.json();
}

export async function rotateApiKey(id) {
  const res = await authFetch(`${BACKEND_URL}/api/v1/servers/${id}/rotate-key`, {
    method: 'POST',
  });
  if (!res || !res.ok) throw new Error('Failed to rotate API key');
  return res.json();
}

export async function fetchServerMetrics(id) {
  const res = await authFetch(`${BACKEND_URL}/api/v1/servers/${id}/metrics`);
  if (!res || !res.ok) throw new Error('Failed to fetch metrics');
  return res.json();
}

export async function fetchDashboardOverview() {
  const res = await authFetch(`${BACKEND_URL}/api/v1/servers/dashboard/overview`);
  if (!res || !res.ok) throw new Error('Failed to fetch dashboard');
  return res.json();
}

export async function fetchLogs(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await authFetch(`${BACKEND_URL}/api/v1/logs${query ? `?${query}` : ''}`);
  if (!res || !res.ok) throw new Error('Failed to fetch logs');
  return res.json();
}

export async function chatWithLogs(message, serverId) {
  const res = await authFetch(`${BACKEND_URL}/api/v1/chat`, {
    method: 'POST',
    body: JSON.stringify({ message, server_id: serverId }),
  });
  if (!res || !res.ok) throw new Error('Failed to send chat message');
  return res.json();
}

export { authFetch };
