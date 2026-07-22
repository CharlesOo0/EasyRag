import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "~/context/auth-context";
import type { ApiError } from "~/lib/api";
import * as authApi from "./api";
import type { PasswordPolicy, User } from "./types";

// Mirrors authentication/validators.py's defaults so a form has a sensible
// schema to validate against before GET /api/password-policy/ resolves (and
// if it's ever unreachable). The backend is the actual source of truth -
// see authentication/views.py::PasswordPolicyView.
const FALLBACK_POLICY: PasswordPolicy = { min_length: 9, special_chars: "@$!%*?&" };

// Shared onSuccess for every mutation that logs a user in (login, google
// login, verify-otp): commits the user to auth context and, if their stored
// profile language differs from the UI's current one, switches the UI to
// match it.
function useOnAuthSuccess() {
  const { setUser } = useAuth();
  const { i18n } = useTranslation();
  return (data: { user: User }) => {
    setUser(data.user);
    if (data.user.language && i18n.language !== data.user.language) {
      i18n.changeLanguage(data.user.language);
    }
  };
}

export function useLogin() {
  const onAuthSuccess = useOnAuthSuccess();
  return useMutation<any, ApiError, { email: string; password: string }>({
    mutationFn: authApi.login,
    onSuccess: onAuthSuccess,
  });
}

export function useRegister() {
  return useMutation<any, ApiError, Record<string, unknown>>({ mutationFn: authApi.register });
}

export function useGoogleLogin() {
  const onAuthSuccess = useOnAuthSuccess();
  return useMutation<any, ApiError, string>({
    mutationFn: authApi.googleLogin,
    onSuccess: onAuthSuccess,
  });
}

export function useVerifyOtp() {
  const onAuthSuccess = useOnAuthSuccess();
  return useMutation<any, ApiError, { email: string; code: string }>({
    mutationFn: ({ email, code }) => authApi.verifyOtp(email, code),
    onSuccess: onAuthSuccess,
  });
}

export function useResendOtp() {
  return useMutation<any, ApiError, string>({ mutationFn: (email) => authApi.resendOtp(email) });
}

export function useLogout() {
  const { setUser } = useAuth();
  return useMutation<void, ApiError, void>({
    mutationFn: async () => {
      try {
        await authApi.logout();
      } catch {
        // Even if the server call fails (e.g. already-expired session),
        // still clear local state so the UI reflects a logged-out user.
      }
    },
    onSuccess: () => setUser(null),
  });
}

export function useRequestPasswordReset() {
  return useMutation<any, ApiError, string>({ mutationFn: (email) => authApi.requestPasswordReset(email) });
}

export function useConfirmPasswordReset() {
  return useMutation<any, ApiError, Parameters<typeof authApi.confirmPasswordReset>[0]>({
    mutationFn: authApi.confirmPasswordReset,
  });
}

export function useVerifyEmail() {
  return useMutation<any, ApiError, string>({ mutationFn: authApi.verifyEmail });
}

export function usePasswordPolicy(): PasswordPolicy {
  const { data } = useQuery({
    queryKey: ["password-policy"],
    queryFn: authApi.fetchPasswordPolicy,
    staleTime: Infinity,
  });
  return data ?? FALLBACK_POLICY;
}

// Escapes characters that are special inside a regex character class
// (`[...]`), so an arbitrary special_chars string from the backend can't
// break the generated pattern.
function escapeForCharClass(chars: string): string {
  return chars.replace(/[\\\]^-]/g, "\\$&");
}

export function specialCharsPattern(policy: PasswordPolicy): RegExp {
  return new RegExp(`[${escapeForCharClass(policy.special_chars)}]`);
}
