/**
 * FxZone REST API Client
 *
 * Reliability improvements:
 *  - Reads the live Supabase access token directly (not a stale localStorage key).
 *  - On 401: asks Supabase to refresh the session automatically; no custom
 *    refresh endpoint needed since Supabase handles it natively.
 *  - Network errors are thrown cleanly without wiping auth state.
 *  - 204 No Content responses are handled gracefully.
 */

import { supabase } from '@/lib/supabase';

const BASE_URL = ''; // Proxied through Next.js rewrite rules in next.config.mjs
const REQUEST_TIMEOUT_MS = 12_000;

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number>;
  /** Use only for endpoints whose response is public for every visitor. */
  public?: boolean;
}

/** Get the current Supabase access token without side-effects. */
async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  if (options.signal) {
    return fetch(url, { ...options, cache: options.cache ?? 'no-store' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, cache: options.cache ?? 'no-store', signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/** Single-flight token refresh lock to prevent stampedes when multiple API calls return 401 concurrently */
async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data.session) {
        return data.session.access_token;
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Perform a network request to the backend with Supabase auth injection.
 */
export async function apiRequest(
  endpoint: string,
  options: RequestOptions = {}
): Promise<any> {
  let url = `${BASE_URL}${endpoint}`;
  const { params: _params, public: publicRequest = false, ...requestOptions } = options;

  // Append query params if present
  if (options.params) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        searchParams.append(key, String(val));
      }
    });
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const headers = new Headers(options.headers || {});

  // Inject the live Supabase token
  if (!publicRequest) {
    const accessToken = await getAccessToken();
    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
  }

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (!publicRequest) {
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('Pragma', 'no-cache');
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(url, {
      ...requestOptions,
      cache: publicRequest ? requestOptions.cache ?? 'default' : 'no-store',
      headers,
    });
  } catch (netErr: any) {
    const timedOut = netErr?.name === 'AbortError';
    const error = new Error(timedOut ? 'The request timed out. Please try again.' : 'Network error: Unable to connect to the server.');
    (error as any).status = 0;
    (error as any).detail = timedOut ? 'Request timed out.' : netErr?.message || 'Connection refused.';
    throw error;
  }

  // On 401 — ask Supabase to refresh the session via shared lock and retry once
  if (response.status === 401 && typeof window !== 'undefined') {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      let retryRes: Response;
      try {
        retryRes = await fetchWithTimeout(url, { ...requestOptions, cache: 'no-store', headers });
      } catch (netErr: any) {
        const error = new Error(netErr?.name === 'AbortError' ? 'The request timed out. Please try again.' : 'Network error: Unable to connect to the server.');
        Object.assign(error, { status: 0, detail: netErr?.message || error.message });
        throw error;
      }
      if (retryRes.status === 204) return null;
      if (!retryRes.ok) {
        const body = await retryRes.json().catch(() => null);
        const msg = body?.detail || body?.message || `HTTP ${retryRes.status}`;
        const err = new Error(msg);
        Object.assign(err, body || {}, { status: retryRes.status, detail: msg });
        throw err;
      }
      return retryRes.json().catch(() => null);
    }
  }

  // 204 No Content — return null gracefully
  if (response.status === 204) return null;

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const detailMsg =
      errorBody?.detail ||
      errorBody?.message ||
      (typeof errorBody === 'string' ? errorBody : null);
    const message =
      detailMsg ||
      `Request failed: ${response.status} ${response.statusText || 'Server Error'}`;
    const error = new Error(message);
    Object.assign(
      error,
      typeof errorBody === 'object' && errorBody ? errorBody : {},
      { status: response.status, detail: message, data: errorBody }
    );
    throw error;
  }

  return response.json().catch(() => null);
}

/**
 * HTTP verb wrappers.
 */
export const api = {
  get: (endpoint: string, options: RequestOptions = {}) =>
    apiRequest(endpoint, { ...options, method: 'GET' }),

  post: (endpoint: string, body?: any, options: RequestOptions = {}) =>
    apiRequest(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  put: (endpoint: string, body?: any, options: RequestOptions = {}) =>
    apiRequest(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  patch: (endpoint: string, body?: any, options: RequestOptions = {}) =>
    apiRequest(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: (endpoint: string, options: RequestOptions = {}) =>
    apiRequest(endpoint, { ...options, method: 'DELETE' }),
};
