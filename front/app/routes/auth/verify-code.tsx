import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { Loader2, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { useVerifyOtp, useResendOtp } from "~/features/auth/hooks";
import { AuthCardShell } from "~/components/auth/auth-card-shell";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyCode() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const email = (location.state as { email?: string } | null)?.email || searchParams.get("email") || "";

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const verifyMutation = useVerifyOtp();
  const resendMutation = useResendOtp();

  const submitCode = (code: string) => {
    if (code.length !== CODE_LENGTH || verifyMutation.isPending) return;
    setError(null);
    verifyMutation.mutate({ email, code }, {
      onSuccess: () => navigate("/"),
      onError: () => {
        setError(t("auth.verifyCode.error"));
        setDigits(Array(CODE_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
      },
    });
  };

  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);

    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (next.every((d) => d !== "")) {
      submitCode(next.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(CODE_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    const focusIndex = Math.min(pasted.length, CODE_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
    if (pasted.length === CODE_LENGTH) {
      submitCode(pasted);
    }
  };

  if (!email) {
    return (
      <AuthCardShell
        showBackToHome={false}
        motionProps={{ initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 } }}
      >
        <Card className="border-border/50 bg-card/50 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden text-center p-8">
          <XCircle className="w-16 h-16 text-destructive mx-auto mb-6" />
          <CardTitle className="text-2xl mb-2">{t("auth.verifyCode.title")}</CardTitle>
          <p className="text-muted-foreground mb-8">{t("auth.verifyCode.missingEmail")}</p>
          <Button asChild className="w-full rounded-xl py-6">
            <Link to="/auth/register">{t("auth.verifyCode.backToRegister")}</Link>
          </Button>
        </Card>
      </AuthCardShell>
    );
  }

  return (
    <AuthCardShell showBackToHome={false}>
      <Card className="border-border/50 bg-card/50 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
        <CardHeader className="space-y-1 text-center pt-8">
          <CardTitle className="text-3xl font-bold tracking-tight">
            {t("auth.verifyCode.title")}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {t("auth.verifyCode.subtitle", { email })}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 px-8">
          <div className="flex justify-center gap-2">
            {digits.map((digit, index) => (
              <Input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                value={digit}
                disabled={verifyMutation.isPending}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className="w-12 h-14 text-center text-xl font-semibold rounded-xl border-border/50 bg-background/50 focus:ring-primary/20"
              />
            ))}
          </div>

          {verifyMutation.isPending && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("auth.verifyCode.verifying")}
            </div>
          )}

          {error && <p className="text-sm font-medium text-destructive text-center">{error}</p>}
          {resendMessage && !error && (
            <p className="text-sm font-medium text-muted-foreground text-center">{resendMessage}</p>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl py-6 font-semibold disabled:opacity-50"
            disabled={cooldown > 0 || resendMutation.isPending}
            onClick={() =>
              resendMutation.mutate(email, {
                onSuccess: () => {
                  setResendMessage(t("auth.verifyCode.resendSuccess"));
                  setError(null);
                  setCooldown(RESEND_COOLDOWN_SECONDS);
                },
                onError: () => {
                  setResendMessage(t("auth.verifyCode.resendError"));
                },
              })
            }
          >
            {resendMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {cooldown > 0
              ? t("auth.verifyCode.resendIn", { seconds: cooldown })
              : t("auth.verifyCode.resend")}
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pb-8">
          <p className="text-sm text-muted-foreground text-center">
            <Link to="/auth/login" className="text-primary font-semibold hover:underline underline-offset-4">
              {t("auth.verify.backToLogin")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthCardShell>
  );
}
