import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

// NOTE: do NOT set a default Content-Type here. Axios auto-detects the body
// type per-request: JSON → 'application/json', FormData → 'multipart/form-data'
// with the required boundary. A hard-coded default overrides that detection
// and silently breaks file uploads (FastAPI returns 422 on the malformed body).
const api = axios.create({
  baseURL: '/api',
});

// Request interceptor: attach JWT access token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Refresh-token machinery ───────────────────────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
}

function clearAuthAndRedirect() {
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

// Endpoints that must never trigger the refresh/redirect flow —
// a 401 from these is a legitimate credential error that the caller
// needs to see (e.g. "Invalid email or password" on the login form).
const AUTH_BYPASS_PATHS = ['/auth/login', '/auth/register', '/auth/guest', '/auth/refresh'];

function isAuthBypass(url: string | undefined): boolean {
  if (!url) return false;
  return AUTH_BYPASS_PATHS.some((p) => url.endsWith(p));
}

// Response interceptor: attempt silent refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Never intercept auth-endpoint failures — propagate so the form can show them.
    if (isAuthBypass(original?.url)) {
      return Promise.reject(error);
    }

    if (error.response?.status !== 401 || original._retry) {
      if (error.response?.status === 401) clearAuthAndRedirect();
      return Promise.reject(error);
    }

    // If another request is already refreshing, queue this one
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((newToken) => {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      clearAuthAndRedirect();
      return Promise.reject(error);
    }

    try {
      const res = await axios.post('/api/auth/refresh', { refresh_token: refreshToken });
      const { access_token, refresh_token: newRefresh } = res.data;

      localStorage.setItem('token', access_token);
      localStorage.setItem('refresh_token', newRefresh);

      processQueue(null, access_token);
      original.headers.Authorization = `Bearer ${access_token}`;
      return api(original);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearAuthAndRedirect();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
