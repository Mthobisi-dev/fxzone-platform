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

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number>;
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

/**
 * Perform a network request to the backend with Supabase auth injection.
 */
export async function apiRequest(
  endpoint: string,
  options: RequestOptions = {}
): Promise<any> {
  let url = `${BASE_URL}${endpoint}`;

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
  const accessToken = await getAccessToken();
  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  headers.set('Pragma', 'no-cache');

  let response: Response;
  try {
    response = await fetch(url, { ...options, cache: 'no-store', headers });
  } catch (netErr: any) {
    const error = new Error('Network error: Unable to connect to the server.');
    (error as any).status = 0;
    (error as any).detail = netErr?.message || 'Connection refused.';
    throw error;
  }

  // On 401 — ask Supabase to refresh the session and retry once
  if (response.status === 401 && typeof window !== 'undefined') {
    try {
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && data.session) {
        const newToken = data.session.access_token;
        headers.set('Authorization', `Bearer ${newToken}`);
        const retryRes = await fetch(url, { ...options, cache: 'no-store', headers });
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
    } catch {
      // Refresh failed — fall through to throw the original 401 error
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
