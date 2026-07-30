/**
 * FxZone REST API Client wrapper with automatic token refresh.
 */

const BASE_URL = ''; // Proxied through Next.js rewrite configuration

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number>;
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
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
      searchParams.append(key, String(val));
    });
    url += `?${searchParams.toString()}`;
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

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle token refresh on 401 Unauthorized
  if (response.status === 401 && typeof window !== 'undefined') {
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
            localStorage.setItem('fxzone_access_token', data.access_token);
            if (data.refresh_token) {
              localStorage.setItem('fxzone_refresh_token', data.refresh_token);
            }
            
            isRefreshing = false;
            onRefreshed(data.access_token);
          } else {
            // Refresh token invalid, clear tokens and redirect to login
            localStorage.removeItem('fxzone_access_token');
            localStorage.removeItem('fxzone_refresh_token');
            isRefreshing = false;
            window.location.href = '/login';
            throw new Error('Session expired. Please log in again.');
          }
        } catch (err) {
          isRefreshing = false;
          throw err;
        }
      }

      // Wait for refresh to complete, then retry the request
      return new Promise((resolve) => {
        subscribeTokenRefresh((token) => {
          headers.set('Authorization', `Bearer ${token}`);
          resolve(
            fetch(url, { ...options, headers }).then((res) => {
              if (!res.ok) {
                return res.json().then((err) => Promise.reject(err));
              }
              return res.json();
            })
          );
        });
      });
    }
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: 'Unknown error occurred.' }));
    throw errorBody;
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
