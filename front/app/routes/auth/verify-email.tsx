import { useEffect, useRef } from "react";
import { useParams, Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useVerifyEmail } from "~/features/auth/hooks";
import { AuthCardShell } from "~/components/auth/auth-card-shell";

export default function VerifyEmail() {
  const { t } = useTranslation();
  const { key: pathKey } = useParams();
  const [searchParams] = useSearchParams();
  const key = pathKey || searchParams.get("key");

  const { mutate, isSuccess, isError } = useVerifyEmail();

  const triggeredRef = useRef(false);
  useEffect(() => {
    if (!key || triggeredRef.current) return;
    triggeredRef.current = true;
    mutate(key);
  }, [key, mutate]);

  const isLoading = !!key && !isSuccess && !isError;

  return (
    <AuthCardShell
      showBackToHome={false}
      motionProps={{ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } }}
    >
      <Card className="border-border/50 bg-card/50 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden text-center p-6">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">{t("auth.verify.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          {isLoading && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-muted-foreground">{t("auth.verify.loading")}</p>
            </div>
          )}

          {isSuccess && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle2 className="w-16 h-16 text-primary" />
              <p className="text-lg font-medium">{t("auth.verify.success")}</p>
              <Button asChild className="mt-4 rounded-xl px-8">
                <Link to="/auth/login" className="flex items-center gap-2">
                  {t("auth.verify.backToLogin")}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          )}

          {(isError || !key) && !isLoading && (
            <div className="flex flex-col items-center gap-4 py-8">
              <XCircle className="w-16 h-16 text-destructive" />
              <p className="text-lg font-medium text-destructive">{t("auth.verify.error")}</p>
              <Button asChild variant="outline" className="mt-4 rounded-xl px-8">
                <Link to="/auth/login">{t("auth.verify.backToLogin")}</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </AuthCardShell>
  );
}
