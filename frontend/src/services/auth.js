import { getAccessToken, getRefreshToken, setTokens, clearTokens, isTokenExpired } from './token';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
const AUTH_SERVICE_URL = import.meta.env.VITE_AUTH_SERVICE_URL || '';

async function authFetch(url, options = {}) {
  let token = getAccessToken();

  if (isTokenExpired(token)) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) return null;
    token = getAccessToken();
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${getAccessToken()}`,
          'Content-Type': 'application/json',
        },
      });
    }
    clearTokens();
    return null;
  }

  return res;
}

let activeRefreshPromise = null;

async function refreshAccessToken() {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken || isTokenExpired(refreshToken)) {
      clearTokens();
      return false;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) {
        clearTokens();
        return false;
      }

      const data = await res.json();
      setTokens(data.access_token, null);
      return true;
    } catch {
      clearTokens();
      return false;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

export const loginWithCredentials = async (email, password) => {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.detail || 'Login failed' };
    }

    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return { success: true, user: data.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const signupWithCredentials = async (email, password, name) => {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.detail || 'Signup failed' };
    }

    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return { success: true, user: data.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const logout = async () => {
  try {
    const token = getAccessToken();
    if (token) {
      await fetch(`${BACKEND_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    }
  } catch {
    // Ignore errors — we clear tokens regardless
  }
  clearTokens();
};

export const getUser = async () => {
  try {
    const res = await authFetch(`${BACKEND_URL}/api/v1/auth/me`);
    if (!res || !res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

export const loginWithGoogle = async () => {
  window.location.href = `${AUTH_SERVICE_URL}/api/auth/google`;
  return { success: true };
};

export const loginWithGithub = async () => {
  window.location.href = `${AUTH_SERVICE_URL}/api/auth/github`;
  return { success: true };
};

export { authFetch, getAccessToken, clearTokens, setTokens };
