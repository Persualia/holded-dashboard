import { getJSON, removeKey, setJSON, STORAGE_KEYS } from './storage';

export function getStoredToken(): string | null {
  return getJSON<string | null>(STORAGE_KEYS.authToken, null);
}

export function setStoredToken(token: string): void {
  setJSON(STORAGE_KEYS.authToken, token);
}

export function clearStoredToken(): void {
  removeKey(STORAGE_KEYS.authToken);
}

export class AuthRequiredError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

/**
 * fetch() wrapper that injects the bearer token. Throws AuthRequiredError on
 * 401 so callers (and the AuthProvider) can react by clearing the session.
 */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401) {
    clearStoredToken();
    throw new AuthRequiredError();
  }
  return res;
}
