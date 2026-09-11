/**
 * Token storage for the authenticated session (00_MASTER_SPEC.md § 10.1).
 *
 * NOTE: localStorage is a pragmatic Phase 1 shell choice, not a final security posture.
 * An httpOnly-cookie-based session (via a backend-for-frontend proxy) removes the XSS
 * exposure a raw JWT/refresh token in localStorage carries, and should be revisited before
 * production launch — see docs/03_ROADMAP.md.
 */

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAtUtc: string;
  /**
   * The account is on a temporary password an Owner issued, and the user has to choose their own
   * before going anywhere. Absent on token pairs minted before this existed, hence optional.
   */
  mustChangePassword?: boolean;
};

const ACCESS_TOKEN_KEY = "mathilens.accessToken";
const REFRESH_TOKEN_KEY = "mathilens.refreshToken";

export function storeTokens(tokens: AuthTokens): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}
