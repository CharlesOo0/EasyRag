import { useGoogleLogin } from "@react-oauth/google";
import { Chrome, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { useGoogleLogin as useGoogleLoginMutation } from "~/features/auth/hooks";
import { useNavigate } from "react-router";

interface GoogleLoginButtonProps {
  onSuccess?: (user: any) => void;
  onError?: (error: any) => void;
}

export function GoogleLoginButton({ onSuccess, onError }: GoogleLoginButtonProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const googleMutation = useGoogleLoginMutation();

  const loginWithGoogle = useGoogleLogin({
    // Authorization-code flow: the browser only ever sees a short-lived,
    // single-use code, never a raw access token. The backend
    // (authentication/views.py::GoogleLogin) exchanges it server-side using
    // the app's client secret - see callback_url='postmessage' there for
    // why the redirect_uri must be that literal string for this popup flow.
    flow: "auth-code",
    onSuccess: (codeResponse) => {
      googleMutation.mutate(codeResponse.code, {
        onSuccess: (data) => {
          if (onSuccess) {
            onSuccess(data.user);
          } else {
            navigate("/");
          }
        },
        onError: (err) => {
          if (onError) {
            onError(err);
          }
        },
      });
    },
    onError: (err) => {
      console.error("Google Login Error:", err);
      if (onError) {
        onError(err);
      }
    },
  });

  return (
    <Button 
      variant="outline" 
      className="w-full rounded-xl py-6 border-border/50 hover:bg-secondary/50 transition-all hover:cursor-pointer"
      onClick={() => loginWithGoogle()}
      disabled={googleMutation.isPending}
    >
      {googleMutation.isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Chrome className="mr-2 h-4 w-4" />
      )}
      {t("auth.common.google")}
    </Button>
  );
}
