import { apiFetch } from "~/lib/api";
import type { PasswordPolicy } from "./types";

// Thin wrappers around apiFetch for every auth endpoint - kept dumb on
// purpose so hooks.ts owns all the state/side-effect logic.

export function login(credentials: { email: string; password: string }) {
  return apiFetch("/login/", { method: "POST", body: JSON.stringify(credentials) });
}

export function register(data: Record<string, unknown>) {
  return apiFetch("/registration/", { method: "POST", body: JSON.stringify(data) });
}

export function logout() {
  return apiFetch("/logout/", { method: "POST" });
}

export function googleLogin(code: string) {
  return apiFetch("/google/", { method: "POST", body: JSON.stringify({ code }) });
}

export function verifyOtp(email: string, code: string) {
  return apiFetch("/verify-otp/", { method: "POST", body: JSON.stringify({ email, code }) });
}

export function resendOtp(email: string) {
  return apiFetch("/resend-otp/", { method: "POST", body: JSON.stringify({ email }) });
}

export function requestPasswordReset(email: string) {
  return apiFetch("/password/reset/", { method: "POST", body: JSON.stringify({ email }) });
}

export function confirmPasswordReset(data: {
  uid: string | undefined;
  token: string | undefined;
  new_password1: string;
  new_password2: string;
}) {
  return apiFetch("/password/reset/confirm/", { method: "POST", body: JSON.stringify(data) });
}

export function verifyEmail(key: string) {
  return apiFetch("/registration/verify-email/", { method: "POST", body: JSON.stringify({ key }) });
}

export function fetchPasswordPolicy(): Promise<PasswordPolicy> {
  return apiFetch("/password-policy/");
}
