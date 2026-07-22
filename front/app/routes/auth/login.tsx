import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import type { ApiError } from "~/lib/api";
import { useLogin } from "~/features/auth/hooks";
import { GoogleLoginButton } from "~/components/auth/google-login-button";
import { AuthCardShell } from "~/components/auth/auth-card-shell";

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const googleClientId = useMemo(() => import.meta.env.VITE_GOOGLE_CLIENT_ID || "", []);

  const loginMutation = useLogin();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    loginMutation.mutate({ email, password }, {
      onSuccess: () => navigate("/"),
      onError: (err: ApiError) => {
        if (err.code === "email_not_verified") {
          navigate("/auth/verify-code", { state: { email } });
        } else {
          setError(t("auth.login.error"));
        }
      },
    });
  };

  return (
    <AuthCardShell>
      <Card className="border-border/50 bg-card/50 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
        <CardHeader className="space-y-1 text-center pt-8">
          <CardTitle className="text-3xl font-bold tracking-tight">
            {t("auth.login.title")}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {t("auth.login.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 px-8">
          <form onSubmit={handleLogin} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">{t("auth.login.emailLabel")}</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                className="rounded-xl border-border/50 bg-background/50 focus:ring-primary/20"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t("auth.login.passwordLabel")}</Label>
                <Link
                  to="/auth/forgot-password"
                  className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  {t("auth.login.forgotPassword")}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                className="rounded-xl border-border/50 bg-background/50 focus:ring-primary/20"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="text-sm font-medium text-destructive text-center">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full rounded-xl py-6 font-semibold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all hover:cursor-pointer"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("auth.login.submit")}
            </Button>
          </form>

          {googleClientId && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground italic">
                    {t("auth.common.or")}
                  </span>
                </div>
              </div>

              <GoogleLoginButton
                onError={() => setError(t("auth.login.error"))}
              />
            </>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pb-8">
          <p className="text-sm text-muted-foreground text-center">
            {t("auth.login.noAccount")}{" "}
            <Link to="/auth/register" className="text-primary font-semibold hover:underline underline-offset-4">
              {t("auth.login.registerLink")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthCardShell>
  );
}