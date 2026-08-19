/**
 * FxZone REST API Client wrapper with automatic token refresh.
 */

const BASE_URL = ''; // Proxied through Next.js rewrite configuration

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number>;
}

let isRefreshing = false;
let refreshSubscribers: Array<{
  resolve: (token: string) => void;
  reject: (err: any) => void;
}> = [];

function subscribeTokenRefresh(): Promise<string> {
  return new Promise((resolve, reject) => {
    refreshSubscribers.push({ resolve, reject });
  });
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach(({ resolve }) => resolve(token));
  refreshSubscribers = [];
}

function onRefreshFailed(err: any) {
  refreshSubscribers.forEach(({ reject }) => reject(err));
  refreshSubscribers = [];
}

/**
 * Perform a network request to the backend with auth header injection.
 */
export async function apiRequest(endpoint: string, options: RequestOptions = {}): Promise<any> {
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
    if (qs) {
      url += `?${qs}`;
    }
  }

  // Inject authorization headers
  const headers = new Headers(options.headers || {});
  const accessToken = typeof window !== 'undefined' ? localStorage.getItem('fxzone_access_token') : null;

  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Strictly disable caching on all API requests to ensure real-time data accuracy
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('Pragma', 'no-cache');
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      cache: 'no-store',
      headers,
    });
  } catch (netErr: any) {
    const error = new Error('Network error: Unable to connect to backend server.');
    (error as any).status = 0;
    (error as any).detail = netErr?.message || 'Connection refused or socket hangup.';
    throw error;
  }

  // Handle token refresh on 401 Unauthorized (except for auth endpoints)
  const isAuthEndpoint = endpoint.includes('/api/auth/login') ||
    endpoint.includes('/api/auth/register') ||
    endpoint.includes('/api/auth/refresh') ||
    endpoint.includes('/api/auth/google');

  if (response.status === 401 && typeof window !== 'undefined' && !isAuthEndpoint) {
    const refreshToken = localStorage.getItem('fxzone_refresh_token');
    
    if (refreshToken) {
      if (!isRefreshing) {
        isRefreshing = true;
        
        try {
          const refreshRes = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            const newToken = data.access_token;
            localStorage.setItem('fxzone_access_token', newToken);
            if (data.refresh_token) {
              localStorage.setItem('fxzone_refresh_token', data.refresh_token);
            }
            
            isRefreshing = false;
            onRefreshed(newToken);

            // Directly retry the initiating request with the new token
            headers.set('Authorization', `Bearer ${newToken}`);
            const retryRes = await fetch(url, { ...options, headers });
            if (!retryRes.ok) {
              const errBody = await retryRes.json().catch(() => null);
              const err = new Error(errBody?.detail || errBody?.message || `HTTP ${retryRes.status}`);
              Object.assign(err, errBody || {}, { status: retryRes.status });
              throw err;
            }
            return retryRes.json();
          } else {
            // Refresh token invalid, clear tokens and redirect to login
            localStorage.removeItem('fxzone_access_token');
            localStorage.removeItem('fxzone_refresh_token');
            isRefreshing = false;
            const sessionErr = new Error('Session expired. Please log in again.');
            onRefreshFailed(sessionErr);
            window.location.href = '/login';
            throw sessionErr;
          }
        } catch (err) {
          isRefreshing = false;
          onRefreshFailed(err);
          throw err;
        }
      } else {
        // Wait for active refresh to complete, then retry the request
        try {
          const newToken = await subscribeTokenRefresh();
          headers.set('Authorization', `Bearer ${newToken}`);
          const retryRes = await fetch(url, { ...options, headers });
          if (!retryRes.ok) {
            const errBody = await retryRes.json().catch(() => null);
            const err = new Error(errBody?.detail || errBody?.message || `HTTP ${retryRes.status}`);
            Object.assign(err, errBody || {}, { status: retryRes.status });
            throw err;
          }
          return retryRes.json();
        } catch (subErr) {
          throw subErr;
        }
      }
    }
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const detailMsg = errorBody?.detail || errorBody?.message || (typeof errorBody === 'string' ? errorBody : null);
    const message = detailMsg || `Request failed with status ${response.status} (${response.statusText || 'Server Error'}).`;
    const error = new Error(message);
    Object.assign(error, typeof errorBody === 'object' && errorBody ? errorBody : {}, {
      status: response.status,
      detail: message,
      data: errorBody,
    });
    throw error;
  }

  return response.json();
}

/**
 * API client HTTP verb wrappers.
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
    
  delete: (endpoint: string, options: RequestOptions = {}) =>
    apiRequest(endpoint, { ...options, method: 'DELETE' }),
};
