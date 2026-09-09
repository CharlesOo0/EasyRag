import { useTranslation } from "react-i18next";

export function EmptyState({ onPick }: { onPick: (question: string) => void }) {
  const { t } = useTranslation();
  const raw = t("chat.examples", { returnObjects: true });
  const examples = Array.isArray(raw) ? (raw as string[]) : [];

  return (
    <div className="pt-8">
      <p className="flex items-center gap-3 font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
        <span className="h-px w-6 bg-current" />
        {t("chat.emptyEyebrow")}
      </p>
      <p className="mt-4 max-w-prose text-lg leading-relaxed text-muted-foreground">
        {t("chat.intro")}
      </p>
      <ul className="mt-6 flex flex-col gap-px overflow-hidden rounded-sm border border-border bg-border">
        {examples.map((question) => (
          <li key={question}>
            <button
              type="button"
              onClick={() => onPick(question)}
              className="group flex w-full cursor-pointer items-center justify-between gap-4 bg-background px-4 py-3 text-left text-sm transition-colors hover:bg-accent"
            >
              <span>{question}</span>
              <span
                aria-hidden="true"
                className="shrink-0 font-mono text-muted-foreground transition-colors group-hover:text-primary"
              >
                &rarr;
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
