/**
 * Thin fetch wrapper matching the backend's response envelope
 * (00_MASTER_SPEC.md § 8.6-8.7). The API base URL is configuration-driven
 * (NEXT_PUBLIC_API_BASE_URL), never hardcoded per environment.
 */

import { clearTokens, getRefreshToken, storeTokens, type AuthTokens } from "@/lib/auth";

export type ApiFieldError = {
  field: string;
  message: string;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

type ApiSuccessResponse<T> = {
  success: true;
  data: T;
  meta?: unknown;
};

type ApiErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
    details: ApiFieldError[] | null;
  };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiFieldError[] | null;

  constructor(status: number, code: string, message: string, details: ApiFieldError[] | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5232";

function authHeaders(token?: string | null): HeadersInit | undefined {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

async function throwIfError(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }

  const body = await response.json().catch(() => null);
  const errorBody = body as ApiErrorBody | null;
  const fallbackMessage =
    response.status === 401 ? "Your session has expired. Please sign in again." : "An unexpected error occurred.";
  throw new ApiError(
    response.status,
    errorBody?.error?.code ?? "UNKNOWN_ERROR",
    errorBody?.error?.message ?? fallbackMessage,
    errorBody?.error?.details ?? null,
  );
}

// Refresh tokens are single-use with rotation and replay detection (01_ARCHITECTURE.md § 17)
// — if two requests 401 at the same moment and both redeem the same refresh token, the second
// looks like a replay and the backend revokes every active token for the user. This in-flight
// promise dedupes concurrent refresh attempts into a single redemption.
let refreshPromise: Promise<string | null> | null = null;

async function redeemRefreshToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      return null;
    }
    const envelope = (await response.json()) as ApiSuccessResponse<AuthTokens>;
    storeTokens(envelope.data);
    return envelope.data.accessToken;
  } catch {
    return null;
  }
}

function refreshAccessTokenOnce(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = redeemRefreshToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * Every authenticated request routes through here: on a 401 from an expired access token, it
 * transparently redeems the refresh token and retries the request once. Requests made without a
 * token (e.g. login itself) are never retried — a 401 there means invalid credentials, not an
 * expired session. If the refresh token is missing/invalid too, the session is over: tokens are
 * cleared and the app is sent back to /login rather than surfacing a confusing generic error.
 */
async function fetchWithAuthRetry(path: string, init: RequestInit, token?: string | null): Promise<Response> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (response.status !== 401 || !token) {
    return response;
  }

  // Signed in somewhere else. Refreshing would be pointless — the refresh token belongs to the
  // superseded session too — and, more importantly, the user deserves to be told why they were
  // thrown out rather than landing on the login screen with no explanation.
  if (response.headers.get("X-Session-Ended") === "superseded") {
    clearTokens();
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login?ended=superseded";
    }
    return response;
  }

  const newAccessToken = await refreshAccessTokenOnce();
  if (!newAccessToken) {
    clearTokens();
    if (typeof window !== "undefined") {
      // A full reload, not router.push: this module runs outside React (no useRouter access),
      // and a hard reset of all component state is exactly what an expired session calls for.
      //
      // Carrying the reason, for the same purpose "superseded" carries its own: landing back on the
      // login screen mid-task with no explanation reads as the app having lost the work.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login?ended=expired";
    }
    return response;
  }

  const retryHeaders = new Headers(init.headers);
  retryHeaders.set("Authorization", `Bearer ${newAccessToken}`);
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers: retryHeaders });
}

async function requestEnvelope<T>(path: string, init?: RequestInit, token?: string | null): Promise<ApiSuccessResponse<T>> {
  const response = await fetchWithAuthRetry(
    path,
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    },
    token,
  );

  await throwIfError(response);

  return (await response.json()) as ApiSuccessResponse<T>;
}

async function request<T>(path: string, init: RequestInit | undefined, token?: string | null): Promise<T> {
  const envelope = await requestEnvelope<T>(path, init, token);
  return envelope.data;
}

export function apiGet<T>(path: string, token?: string | null): Promise<T> {
  return request<T>(path, { headers: authHeaders(token) }, token);
}

/** For paginated collection endpoints (00_MASTER_SPEC.md § 8.3) — surfaces `meta` alongside the items. */
export async function apiGetPaged<T>(path: string, token?: string | null): Promise<{ items: T[]; meta: PaginationMeta }> {
  const envelope = await requestEnvelope<T[]>(path, { headers: authHeaders(token) }, token);
  return { items: envelope.data, meta: envelope.meta as PaginationMeta };
}

export function apiPost<T>(path: string, payload: unknown, token?: string | null): Promise<T> {
  return request<T>(
    path,
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
    token,
  );
}

export function apiPut<T>(path: string, payload: unknown, token?: string | null): Promise<T> {
  return request<T>(
    path,
    {
      method: "PUT",
      body: JSON.stringify(payload),
      headers: authHeaders(token),
    },
    token,
  );
}

/** For endpoints that return 204 No Content on success — never attempts to parse a body. */
export async function apiDelete(path: string, token?: string | null): Promise<void> {
  const response = await fetchWithAuthRetry(path, { method: "DELETE", headers: authHeaders(token) }, token);

  await throwIfError(response);
}

/**
 * For PUT endpoints that return 204 No Content on success — never attempts to parse a body.
 *
 * apiPut always reads the response as JSON, so pointing it at a 204 throws a SyntaxError on an empty
 * body. That is not an ApiError, so callers reported a generic failure for a change the server had
 * already made — which is exactly what "changing a user's role does nothing" turned out to be.
 */
export async function apiPutNoContent(path: string, payload: unknown, token?: string | null): Promise<void> {
  const response = await fetchWithAuthRetry(
    path,
    {
      method: "PUT",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(token),
      },
    },
    token,
  );

  await throwIfError(response);
}

/** For DELETE endpoints that return the mutated resource in the standard envelope rather than 204. */
export async function apiDeleteFor<T>(path: string, token?: string | null): Promise<T> {
  return request<T>(path, { method: "DELETE", headers: authHeaders(token) }, token);
}

/**
 * Downloads a file endpoint (spreadsheet exports). Returns the raw blob plus the filename the
 * server chose, so the caller doesn't have to duplicate the naming convention.
 */
export async function apiGetFile(
  path: string,
  token?: string | null,
  /**
   * Used only when the server's filename cannot be read. It must match the file actually being
   * fetched: this defaulted to "export.xlsx" and so handed back PDFs under a spreadsheet's name
   * whenever Content-Disposition was unreadable, which cross-origin it always was until the API
   * began exposing that header.
   */
  fallbackFilename = "export",
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetchWithAuthRetry(path, { headers: authHeaders(token) }, token);

  await throwIfError(response);

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);

  return {
    blob: await response.blob(),
    filename: match ? decodeURIComponent(match[1]) : fallbackFilename,
  };
}

/**
 * Uploads a single file as multipart/form-data. Deliberately does not set Content-Type — the
 * browser has to append its own multipart boundary, and naming the type here would strip it.
 */
export async function apiPostFile<T>(path: string, file: File, token?: string | null): Promise<T> {
  const body = new FormData();
  body.append("file", file);

  const response = await fetchWithAuthRetry(path, { method: "POST", body, headers: authHeaders(token) }, token);

  await throwIfError(response);

  const envelope = (await response.json()) as ApiSuccessResponse<T>;
  return envelope.data;
}

/** For POST endpoints (typically actions, not resource creation) that return 204 No Content on success — never attempts to parse a body. */
export async function apiPostNoContent(path: string, payload: unknown, token?: string | null): Promise<void> {
  const response = await fetchWithAuthRetry(
    path,
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(token),
      },
    },
    token,
  );

  await throwIfError(response);
}
