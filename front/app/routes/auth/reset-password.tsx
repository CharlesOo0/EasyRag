import { Link, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { useConfirmPasswordReset, usePasswordPolicy, specialCharsPattern } from "~/features/auth/hooks";
import { AuthCardShell } from "~/components/auth/auth-card-shell";

export default function ResetPassword() {
  const { t } = useTranslation();
  const { uid, token } = useParams();
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const passwordPolicy = usePasswordPolicy();

  const resetPasswordSchema = z.object({
    newPassword: z.string()
      .min(passwordPolicy.min_length, t("auth.resetPassword.passwordInvalid"))
      .regex(/[a-z]/, t("auth.resetPassword.passwordInvalid"))
      .regex(/[A-Z]/, t("auth.resetPassword.passwordInvalid"))
      .regex(/\d/, t("auth.resetPassword.passwordInvalid"))
      .regex(specialCharsPattern(passwordPolicy), t("auth.resetPassword.passwordInvalid")),
    confirmPassword: z.string(),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: t("auth.resetPassword.passwordMismatch"),
    path: ["confirmPassword"],
  });

  type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const resetPasswordMutation = useConfirmPasswordReset();

  const onSubmit = (data: ResetPasswordValues) => {
    setServerError(null);
    resetPasswordMutation.mutate(
      {
        uid,
        token,
        new_password1: data.newPassword,
        new_password2: data.confirmPassword,
      },
      {
        onSuccess: () => setSuccess(true),
        onError: () => setServerError(t("auth.resetPassword.error")),
      },
    );
  };

  return (
    <AuthCardShell>
      <Card className="border-border/50 bg-card/50 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
        {success ? (
          <CardContent className="text-center p-8">
            <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-6" />
            <CardTitle className="text-2xl mb-2">{t("auth.resetPassword.title")}</CardTitle>
            <p className="text-muted-foreground mb-8">{t("auth.resetPassword.success")}</p>
            <Button asChild className="w-full rounded-xl py-6">
              <Link to="/auth/login">{t("auth.resetPassword.backToLogin")}</Link>
            </Button>
          </CardContent>
        ) : serverError && resetPasswordMutation.isError ? (
          <CardContent className="text-center p-8">
            <XCircle className="w-16 h-16 text-destructive mx-auto mb-6" />
            <p className="text-lg font-medium text-destructive mb-8">{serverError}</p>
            <Button asChild variant="outline" className="w-full rounded-xl py-6">
              <Link to="/auth/forgot-password">{t("auth.forgotPassword.title")}</Link>
            </Button>
          </CardContent>
        ) : (
          <>
            <CardHeader className="space-y-1 text-center pt-8">
              <CardTitle className="text-3xl font-bold tracking-tight">
                {t("auth.resetPassword.title")}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {t("auth.resetPassword.subtitle")}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 px-8">
              <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="newPassword">{t("auth.resetPassword.newPasswordLabel")}</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    className="rounded-xl border-border/50 bg-background/50 focus:ring-primary/20"
                    {...register("newPassword")}
                  />
                  {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword">{t("auth.resetPassword.confirmPasswordLabel")}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    className="rounded-xl border-border/50 bg-background/50 focus:ring-primary/20"
                    {...register("confirmPassword")}
                  />
                  {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
                </div>

                <Button
                  type="submit"
                  className="w-full rounded-xl py-6 font-semibold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all disabled:opacity-50"
                  disabled={resetPasswordMutation.isPending}
                >
                  {resetPasswordMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {t("auth.resetPassword.submit")}
                </Button>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </AuthCardShell>
  );
}
