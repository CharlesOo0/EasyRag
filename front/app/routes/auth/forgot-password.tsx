import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { useRequestPasswordReset } from "~/features/auth/hooks";
import { AuthCardShell } from "~/components/auth/auth-card-shell";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestResetMutation = useRequestPasswordReset();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    requestResetMutation.mutate(email, {
      onSuccess: () => setSuccess(true),
      onError: () => setError(t("auth.forgotPassword.error")),
    });
  };

  return (
    <AuthCardShell>
      <Card className="border-border/50 bg-card/50 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
        {success ? (
          <CardContent className="text-center p-8">
            <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-6" />
            <CardTitle className="text-2xl mb-2">{t("auth.forgotPassword.title")}</CardTitle>
            <p className="text-muted-foreground mb-8">{t("auth.forgotPassword.success")}</p>
            <Button asChild className="w-full rounded-xl py-6">
              <Link to="/auth/login">{t("auth.forgotPassword.backToLogin")}</Link>
            </Button>
          </CardContent>
        ) : (
          <>
            <CardHeader className="space-y-1 text-center pt-8">
              <CardTitle className="text-3xl font-bold tracking-tight">
                {t("auth.forgotPassword.title")}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {t("auth.forgotPassword.subtitle")}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 px-8">
              <form onSubmit={handleSubmit} className="grid gap-4">
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

                {error && (
                  <p className="text-sm font-medium text-destructive text-center">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full rounded-xl py-6 font-semibold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all hover:cursor-pointer"
                  disabled={requestResetMutation.isPending}
                >
                  {requestResetMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {t("auth.forgotPassword.submit")}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 pb-8">
              <p className="text-sm text-muted-foreground text-center">
                <Link to="/auth/login" className="text-primary font-semibold hover:underline underline-offset-4">
                  {t("auth.forgotPassword.backToLogin")}
                </Link>
              </p>
            </CardFooter>
          </>
        )}
      </Card>
    </AuthCardShell>
  );
}
