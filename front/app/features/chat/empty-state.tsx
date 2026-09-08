import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";

export function EmptyState({ onPick }: { onPick: (question: string) => void }) {
  const { t } = useTranslation();
  const raw = t("chat.examples", { returnObjects: true });
  const examples = Array.isArray(raw) ? (raw as string[]) : [];

  return (
    <div className="pt-16 flex flex-col items-center text-center gap-5">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
        <Sparkles className="w-6 h-6 text-primary" />
      </div>
      <p className="max-w-md text-muted-foreground">{t("chat.intro")}</p>
      <div className="flex flex-wrap justify-center gap-2 max-w-lg">
        {examples.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => onPick(question)}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted transition-colors"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
