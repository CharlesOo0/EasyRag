import { Link } from "react-router";
import { motion, type HTMLMotionProps } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";

interface AuthCardShellProps {
  children: React.ReactNode;
  showBackToHome?: boolean;
  className?: string;
  motionProps?: HTMLMotionProps<"div">;
}

const DEFAULT_MOTION: HTMLMotionProps<"div"> = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

// Shared chrome for every /auth/* page: the blurred background decor, the
// optional "back to home" link, and the fade/slide-in motion wrapper around
// the page's <Card>. Pulled out of login/register/forgot-password/
// reset-password/verify-code/verify-email so a visual tweak only needs to
// happen in one place.
export function AuthCardShell({ children, showBackToHome = true, className, motionProps }: AuthCardShellProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden px-4">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] -z-10" />

      {showBackToHome && (
        <Link
          to="/"
          className="absolute top-8 left-8 flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("common.backToHome", "Retour à l'accueil")}
        </Link>
      )}

      <motion.div {...(motionProps ?? DEFAULT_MOTION)} className={cn("w-full max-w-md", className)}>
        {children}
      </motion.div>
    </div>
  );
}
