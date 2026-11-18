import type { UserRecord } from '../types/cms';
import { localCmsFetch } from './localCms';

function safeGetStorage(key: string): string {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(key) || '' : '';
  } catch {
    return '';
  }
}

function safeSetStorage(key: string, val: string) {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, val);
  } catch {
    // ignore storage quota / privacy mode errors
  }
}

function safeRemoveStorage(key: string) {
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

let authToken = safeGetStorage('balagarh_cms_token');
let csrfToken = safeGetStorage('balagarh_cms_csrf');
let localCmsMode = safeGetStorage('balagarh_cms_mode') === 'local' || authToken.startsWith('local:');
let backendProbePromise: Promise<'persistent' | 'local'> | null = null;

type AuthExpiredListener = (reason: string) => void;
const authExpiredListeners = new Set<AuthExpiredListener>();

export function onAuthExpired(listener: AuthExpiredListener): () => void {
  authExpiredListeners.add(listener);
  return () => {
    authExpiredListeners.delete(listener);
  };
}

function notifyAuthExpired(reason: string) {
  clearSessionTokens();
  authExpiredListeners.forEach((fn) => {
    try {
      fn(reason);
    } catch {
      // ignore listener errors
    }
  });
}

function isSessionAuthError(url: string, status?: number, message?: string): boolean {
  if (status !== 401) return false;
  if (url === '/api/auth/login') return false;
  const msg = String(message || '');
  // Wrong current password in change-password should NOT log the user out
  if (url === '/api/auth/change-password' && /current password is incorrect/i.test(msg)) {
    return false;
  }
  return /authentication required|invalid or inactive user/i.test(msg);
}

export function setSessionTokens(token: string, csrf: string) {
  authToken = token;
  csrfToken = csrf;
  safeSetStorage('balagarh_cms_token', token);
  safeSetStorage('balagarh_cms_csrf', csrf);
  if (token.startsWith('local:')) {
    localCmsMode = true;
    safeSetStorage('balagarh_cms_mode', 'local');
  }
}

export function clearSessionTokens() {
  authToken = '';
  csrfToken = '';
  safeRemoveStorage('balagarh_cms_token');
  safeRemoveStorage('balagarh_cms_csrf');
}

export function getAuthToken() {
  return authToken;
}

export function isLocalCmsMode() {
  return localCmsMode;
}

export function initBackendMode(): Promise<'persistent' | 'local'> {
  if (backendProbePromise) return backendProbePromise;
  backendProbePromise = (async () => {
    try {
      const res = await fetch('/api/health');
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      const persistenceHeader = (res.headers.get('x-cms-persistence') || '').toLowerCase();
      if (!res.ok || !ct.includes('application/json') || persistenceHeader === 'ephemeral') {
        localCmsMode = true;
        safeSetStorage('balagarh_cms_mode', 'local');
        return 'local';
      }
      const data = (await res.json()) as { ok?: boolean; persistent?: boolean };
      if (data?.ok && data?.persistent) {
        localCmsMode = false;
        safeRemoveStorage('balagarh_cms_mode');
        if (authToken.startsWith('local:')) {
          clearSessionTokens();
        }
        return 'persistent';
      }
      localCmsMode = true;
      safeSetStorage('balagarh_cms_mode', 'local');
      return 'local';
    } catch {
      localCmsMode = true;
      safeSetStorage('balagarh_cms_mode', 'local');
      return 'local';
    }
  })();
  return backendProbePromise;
}

async function ensureCsrfToken(): Promise<string> {
  if (localCmsMode || authToken.startsWith('local:')) return 'local-csrf-token';
  if (csrfToken) return csrfToken;
  try {
    const res = await fetch('/api/auth/csrf');
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const persistence = (res.headers.get('x-cms-persistence') || '').toLowerCase();
    if (persistence === 'ephemeral' || !res.ok || !ct.includes('application/json')) {
      localCmsMode = true;
      safeSetStorage('balagarh_cms_mode', 'local');
      csrfToken = 'local-csrf-token';
      return csrfToken;
    }
    const text = await res.text();
    const data = text ? (JSON.parse(text) as { csrfToken?: string }) : {};
    csrfToken = data.csrfToken || 'local-csrf-token';
    safeSetStorage('balagarh_cms_csrf', csrfToken);
    return csrfToken;
  } catch {
    localCmsMode = true;
    safeSetStorage('balagarh_cms_mode', 'local');
    csrfToken = 'local-csrf-token';
    return csrfToken;
  }
}

async function runLocalCms<T>(url: string, options: RequestInit, headers: Headers): Promise<T> {
  localCmsMode = true;
  safeSetStorage('balagarh_cms_mode', 'local');
  try {
    return await localCmsFetch<T>(url, { ...options, headers });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (isSessionAuthError(url, e?.status, e?.message)) {
      notifyAuthExpired(e.message || 'Authentication required');
    }
    throw err;
  }
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  if (!(options.body instanceof FormData) && options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (localCmsMode || authToken.startsWith('local:')) {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      headers.set('X-CSRF-Token', 'local-csrf-token');
    }
    return runLocalCms<T>(url, options, headers);
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const token = await ensureCsrfToken();
    if (localCmsMode) {
      headers.set('X-CSRF-Token', 'local-csrf-token');
      return runLocalCms<T>(url, options, headers);
    }
    if (token) headers.set('X-CSRF-Token', token);
  }

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    return runLocalCms<T>(url, options, headers);
  }

  let contentType = (res.headers.get('content-type') || '').toLowerCase();
  const persistence = (res.headers.get('x-cms-persistence') || '').toLowerCase();

  if (persistence === 'ephemeral') {
    return runLocalCms<T>(url, options, headers);
  }
  if (persistence === 'persistent') {
    localCmsMode = false;
    safeRemoveStorage('balagarh_cms_mode');
  }

  if (res.status === 403 && contentType.includes('application/json') && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    // Refresh CSRF token once if server restarted
    csrfToken = '';
    const fresh = await ensureCsrfToken();
    if (localCmsMode) {
      headers.set('X-CSRF-Token', 'local-csrf-token');
      return runLocalCms<T>(url, options, headers);
    }
    if (fresh) headers.set('X-CSRF-Token', fresh);
    try {
      res = await fetch(url, { ...options, headers });
      contentType = (res.headers.get('content-type') || '').toLowerCase();
    } catch {
      return runLocalCms<T>(url, options, headers);
    }
  }

  const isApiMissing =
    !contentType.includes('application/json') ||
    res.status >= 500 ||
    (res.status === 404 &&
      (url.startsWith('/api/auth/') || url.startsWith('/api/admin/') || url === '/api/public/bootstrap'));

  if (isApiMissing) {
    return runLocalCms<T>(url, options, headers);
  }

  let rawText = '';
  try {
    rawText = await res.text();
  } catch {
    return runLocalCms<T>(url, options, headers);
  }

  let data: Record<string, unknown> = {};
  if (rawText.trim()) {
    try {
      data = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      return runLocalCms<T>(url, options, headers);
    }
  }

  if (!res.ok) {
    const err = new Error(String(data.error || `Request failed (${res.status})`)) as Error & {
      status?: number;
      usage?: unknown;
    };
    err.status = res.status;
    if (data.usage !== undefined) err.usage = data.usage;
    if (isSessionAuthError(url, res.status, err.message)) {
      notifyAuthExpired(err.message);
    }
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

export async function switchAdminRole(username: string): Promise<UserRecord> {
  const res = await apiFetch<{ token: string; csrfToken: string; user: UserRecord }>('/api/admin/switch-role', {
    method: 'POST',
    body: JSON.stringify({ username }),
  });
  setSessionTokens(res.token, res.csrfToken);
  return res.user;
}
