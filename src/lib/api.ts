import type { UserRecord } from '../types/cms';

let authToken = localStorage.getItem('balagarh_cms_token') || '';
let csrfToken = localStorage.getItem('balagarh_cms_csrf') || '';

export function setSessionTokens(token: string, csrf: string) {
  authToken = token;
  csrfToken = csrf;
  localStorage.setItem('balagarh_cms_token', token);
  localStorage.setItem('balagarh_cms_csrf', csrf);
}

export function clearSessionTokens() {
  authToken = '';
  localStorage.removeItem('balagarh_cms_token');
}

export function getAuthToken() {
  return authToken;
}

async function ensureCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const res = await fetch('/api/auth/csrf');
  const data = await res.json();
  csrfToken = data.csrfToken || '';
  localStorage.setItem('balagarh_cms_csrf', csrfToken);
  return csrfToken;
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const token = await ensureCsrfToken();
    if (token) headers.set('X-CSRF-Token', token);
  }
  if (!(options.body instanceof FormData) && options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let res = await fetch(url, { ...options, headers });
  if (res.status === 403 && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    // Refresh CSRF token once if server restarted
    csrfToken = '';
    const fresh = await ensureCsrfToken();
    if (fresh) headers.set('X-CSRF-Token', fresh);
    res = await fetch(url, { ...options, headers });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function loginDemoRole(username: string): Promise<UserRecord> {
  const res = await apiFetch<{ token: string; csrfToken: string; user: UserRecord }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, demoSwitch: true }),
  });
  setSessionTokens(res.token, res.csrfToken);
  return res.user;
}

export async function loginWithPassword(username: string, password: string): Promise<UserRecord> {
  const res = await apiFetch<{ token: string; csrfToken: string; user: UserRecord }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setSessionTokens(res.token, res.csrfToken);
  return res.user;
}
