import type { UserRecord } from '../types/cms';
import { localCmsFetch } from './localCms';

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
  if (authToken.startsWith('local:')) return 'local-csrf-token';
  if (csrfToken) return csrfToken;
  try {
    const res = await fetch('/api/auth/csrf');
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok || !ct.includes('application/json')) {
      csrfToken = 'local-csrf-token';
      return csrfToken;
    }
    const data = await res.json();
    csrfToken = data.csrfToken || 'local-csrf-token';
    localStorage.setItem('balagarh_cms_csrf', csrfToken);
    return csrfToken;
  } catch {
    csrfToken = 'local-csrf-token';
    return csrfToken;
  }
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  if (authToken.startsWith('local:')) {
    return localCmsFetch<T>(url, options);
  }

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

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    return localCmsFetch<T>(url, options);
  }

  let contentType = (res.headers.get('content-type') || '').toLowerCase();

  if (res.status === 403 && contentType.includes('application/json') && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    // Refresh CSRF token once if server restarted
    csrfToken = '';
    const fresh = await ensureCsrfToken();
    if (fresh) headers.set('X-CSRF-Token', fresh);
    try {
      res = await fetch(url, { ...options, headers });
      contentType = (res.headers.get('content-type') || '').toLowerCase();
    } catch {
      return localCmsFetch<T>(url, options);
    }
  }

  const isApiMissing =
    !contentType.includes('application/json') ||
    res.status === 502 ||
    res.status === 503 ||
    res.status === 504 ||
    (res.status === 404 &&
      (url.startsWith('/api/auth/') || url.startsWith('/api/admin/') || url === '/api/public/bootstrap'));

  if (isApiMissing) {
    return localCmsFetch<T>(url, options);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`) as Error & {
      status?: number;
      usage?: unknown;
    };
    err.status = res.status;
    if (data.usage !== undefined) err.usage = data.usage;
    throw err;
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
