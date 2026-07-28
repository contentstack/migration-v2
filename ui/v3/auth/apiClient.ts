/**
 * v3 API client.
 *
 * A single axios instance that every v3 service/feature call must go through.
 * - Request interceptor attaches the auth token as the `app_token` header
 *   (identical to v2's per-call header injection, but in ONE place). The token
 *   is read fresh from ./token on every request — never cached.
 * - Response interceptor treats HTTP 401 as "logged out": it clears the token
 *   and sends the user to the login entry.
 *
 * No per-call header injection is allowed elsewhere in v3. This is Phase 0 of
 * docs/features/auth-httponly-cookie-migration/plan.md — the mechanism is
 * unchanged (localStorage JWT + `app_token` header); it is merely centralized so
 * a future httpOnly-cookie switch touches only this file and ./token.
 */
import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';

import { clearToken, getToken } from './token';

/** Read env directly — do NOT import from ../../src, v3 stays self-contained. */
const BASE_API_URL: string = import.meta.env.VITE_BASE_API_URL ?? '';

/** Request header the API's auth middleware reads (`req.get("app_token")`). */
const AUTH_HEADER = 'app_token';

/**
 * Where to send a logged-out user. Matches the shared app's login entry: v2
 * mounts the login/home page at "/" and its PrivateRoute redirects there.
 */
const LOGIN_PATH = '/';

const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_API_URL,
});

// Attach the auth token to every outgoing request (read fresh, never cached).
apiClient.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  const token = getToken();
  if (token) {
    // axios v1: headers is an AxiosHeaders instance.
    cfg.headers.set(AUTH_HEADER, token);
  }
  return cfg;
});

// Treat 401 as logged-out: clear the token and redirect to login (once).
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error?.response?.status === 401) {
      clearToken();
      if (
        typeof window !== 'undefined' &&
        window.location.pathname !== LOGIN_PATH
      ) {
        window.location.replace(LOGIN_PATH);
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
