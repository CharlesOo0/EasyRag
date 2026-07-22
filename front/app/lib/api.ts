import i18next from "i18next";
import { clearStoredUser } from "~/features/auth/storage";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

// Every rejection out of apiFetch is one of these, regardless of which
// branch below threw it (a parsed DRF error body, a failed silent refresh,
// or a network-level failure) - callers shouldn't have to guess whether
// `code` is a string or a one-element array, or whether they got a parsed
// body or a bare Error.
export interface ApiError {
  status: number;
  detail: string;
  code: string | null;
  fields: Record<string, string[]>;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
  return null;
}

// DRF renders validation errors as either a bare scalar (our own APIViews,
// e.g. VerifyOTPView's {"code": "invalid_otp"}) or a one-element array
// (serializer.ValidationError, e.g. LoginSerializer's {"code": ["email_not_verified"]}).
// Flatten both shapes to a single string so callers only ever deal with one.
function flattenToString(value: unknown): string | null {
  if (Array.isArray(value)) return value.length ? String(value[0]) : null;
  if (value === null || value === undefined) return null;
  return String(value);
}

function normalizeApiError(status: number, body: Record<string, unknown>, fallbackDetail: string): ApiError {
  const { detail, code, ...fields } = body;
  return {
    status,
    detail: flattenToString(detail) ?? fallbackDetail,
    code: flattenToString(code),
    fields: Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.map(String) : [String(value)],
      ]),
    ),
  };
}

export async function apiFetch(endpoint: string, options: RequestInit = {}, _retried = false): Promise<any> {
  const language = i18next.language || "fr";
  const csrfToken = getCookie("csrftoken");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept-Language": language,
    ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
    ...(options.headers as Record<string, string>),
  };

  const url = endpoint.startsWith("http") ? endpoint : `${API_URL}${endpoint}`;

  // Always send credentials (cookies) so the JWT auth/CSRF cookies go out
  // with every request.
  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: options.credentials || "include",
  };

  const response = await fetch(url, fetchOptions);

  const isAuthEndpoint =
    endpoint.includes("/login/") ||
    endpoint.includes("/token/refresh/") ||
    endpoint.includes("/registration/");

  // Attempt a single silent refresh-and-retry on 401, except for the auth
  // endpoints themselves (a 401 there is a real login/refresh/registration
  // failure, not an expired session) - guarded by `_retried` so a request
  // that still 401s after refreshing can't loop forever.
  if (response.status === 401 && !isAuthEndpoint) {
    if (_retried) {
      clearStoredUser();
      if (typeof window !== "undefined" && !window.location.pathname.includes("/auth/")) {
        window.location.href = "/auth/login";
      }
      throw normalizeApiError(401, {}, "Session expired");
    }

    const refreshResponse = await fetch(`${API_URL}/token/refresh/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
      },
      credentials: "include",
    });

    if (refreshResponse.ok) {
      return apiFetch(endpoint, options, true);
    }

    clearStoredUser();
    if (typeof window !== "undefined" && !window.location.pathname.includes("/auth/")) {
      window.location.href = "/auth/login";
    }
    throw normalizeApiError(401, {}, "Session expired");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw normalizeApiError(response.status, data, response.statusText || "Request failed");
  }

  return data;
}
