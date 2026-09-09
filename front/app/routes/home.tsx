import type { ReactNode } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, Github, Languages } from "lucide-react";

export function meta() {
  return [
    { title: "EasyRag" },
    {
      name: "description",
      content:
        "A local-only RAG showcase: 195 CIA World Factbook country profiles, indexed into pgvector, answered with citations.",
    },
  ];
}

const STEP_KEYS = ["ingest", "embed", "retrieve", "generate"] as const;
const STACK_KEYS = ["store", "embed", "llm"] as const;
// Passage vectors, roughly, from the current corpus — mentioned on the page.
const CORPUS_COUNT = "195";

export default function Home() {
  const { t, i18n } = useTranslation();
  const toggleLanguage = () =>
    i18n.changeLanguage(i18n.language === "fr" ? "en" : "fr");
  const examples = asArray(t("home.tryIt.examples", { returnObjects: true }));

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteNav toggleLanguage={toggleLanguage} label={t("home.toggleLanguage")} cta={t("home.openChat")} />

      <main className="flex-1">
        <Hero
          eyebrow={t("home.hero.eyebrow")}
          title={t("home.hero.title")}
          subtitle={t("home.hero.subtitle")}
          openChat={t("home.openChat")}
          viewSource={t("home.viewSource")}
        />

        <Pipeline
          title={t("home.pipeline.title")}
          subtitle={t("home.pipeline.subtitle")}
          steps={STEP_KEYS.map((key) => ({
            key,
            title: t(`home.pipeline.steps.${key}.title`),
            description: t(`home.pipeline.steps.${key}.description`),
            meta: t(`home.pipeline.steps.${key}.meta`),
          }))}
        />

        <section className="mx-auto grid max-w-5xl gap-x-12 gap-y-12 border-t border-border px-4 py-16 sm:px-6 lg:grid-cols-2">
          <div>
            <SectionLabel>{t("home.corpus.title")}</SectionLabel>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="font-heading text-5xl font-semibold tabular-nums">
                {CORPUS_COUNT}
              </span>
              <span className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
                {t("home.corpus.statLabel")}
              </span>
            </div>
            <p className="mt-4 max-w-prose text-muted-foreground">{t("home.corpus.body")}</p>
          </div>

          <div>
            <SectionLabel>{t("home.stack.title")}</SectionLabel>
            <dl className="mt-4 border-t border-border">
              {STACK_KEYS.map((key) => (
                <div
                  key={key}
                  className="grid gap-1 border-b border-border py-3 sm:grid-cols-[10rem_1fr] sm:gap-4"
                >
                  <dt className="font-mono text-sm text-foreground">
                    {t(`home.stack.items.${key}.name`)}
                  </dt>
                  <dd className="text-sm text-muted-foreground">
                    {t(`home.stack.items.${key}.description`)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm text-muted-foreground">{t("home.stack.note")}</p>
          </div>
        </section>

        <section className="border-t border-border bg-accent/40">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
            <SectionLabel>{t("home.tryIt.title")}</SectionLabel>
            <ul className="mt-5 flex flex-col gap-px overflow-hidden rounded-sm border border-border bg-border sm:mt-6">
              {examples.map((q) => (
                <li key={q}>
                  <Link
                    to={`/chat?q=${encodeURIComponent(q)}`}
                    className="group flex items-center justify-between gap-4 bg-background px-4 py-3 text-sm transition-colors hover:bg-accent"
                  >
                    <span>{q}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              to="/chat"
              className="mt-6 inline-flex items-center gap-2 rounded-sm bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t("home.openChat")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="text-sm text-muted-foreground">{t("home.footer")}</span>
          <a
            href="https://github.com/CharlesOo0/EasyRag"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-xs tracking-wider text-muted-foreground uppercase transition-colors hover:text-foreground"
          >
            <Github className="h-4 w-4" />
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

function SiteNav({
  toggleLanguage,
  label,
  cta,
}: {
  toggleLanguage: () => void;
  label: string;
  cta: string;
}) {
  return (
    <nav className="border-b border-border">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <span className="flex items-center gap-2 font-heading text-lg font-semibold tracking-tight">
          <CompassMark className="h-5 w-5 text-primary" />
          <span>
            Easy<span className="text-primary">Rag</span>
          </span>
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleLanguage}
            className="rounded-sm p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={label}
          >
            <Languages className="h-4 w-4" />
          </button>
          <Link
            to="/chat"
            className="ml-1 inline-flex items-center gap-1.5 rounded-sm bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {cta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Hero({
  eyebrow,
  title,
  subtitle,
  openChat,
  viewSource,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  openChat: string;
  viewSource: string;
}) {
  const { t } = useTranslation();
  return (
    <section className="mx-auto grid max-w-5xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_26rem] lg:items-center lg:py-24">
      <div>
        <p className="flex items-center gap-3 font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
          <span className="h-px w-6 bg-current" />
          {eyebrow}
        </p>
        <h1 className="mt-5 font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        <p className="mt-5 max-w-prose text-lg text-muted-foreground">{subtitle}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/chat"
            className="inline-flex items-center justify-center gap-2 rounded-sm bg-primary px-5 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {openChat}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="https://github.com/CharlesOo0/EasyRag"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-sm border border-border px-5 py-3 font-medium transition-colors hover:bg-accent"
          >
            <Github className="h-4 w-4" />
            {viewSource}
          </a>
        </div>
      </div>

      <Specimen
        caption={t("home.demo.caption")}
        you={t("home.demo.you")}
        assistant={t("home.demo.assistant")}
        question={t("home.demo.question")}
        answer={t("home.demo.answer")}
        sourcesLabel={t("home.demo.sourcesLabel")}
        source1={t("home.demo.source1")}
        source2={t("home.demo.source2")}
      />
    </section>
  );
}

/** A framed inset — a map-plate rendering of one chat exchange, citations and
 * all. Static; illustrative. */
function Specimen({
  caption,
  you,
  assistant,
  question,
  answer,
  sourcesLabel,
  source1,
  source2,
}: Record<
  "caption" | "you" | "assistant" | "question" | "answer" | "sourcesLabel" | "source1" | "source2",
  string
>) {
  const parts = answer.split(/(\[\d\])/);
  return (
    <div className="relative">
      <CornerTicks />
      <div className="border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-3 py-2 font-mono text-[0.7rem] tracking-wider text-muted-foreground uppercase">
          <span>/chat</span>
          <span>{caption}</span>
        </div>
        <div className="space-y-3 p-4 text-sm">
          <p className="font-mono text-[0.65rem] tracking-wider text-muted-foreground uppercase">
            {you}
          </p>
          <p className="border-l-2 border-border pl-3">{question}</p>
          <p className="pt-1 font-mono text-[0.65rem] tracking-wider text-muted-foreground uppercase">
            {assistant}
          </p>
          <p className="leading-relaxed">
            {parts.map((part, i) =>
              /^\[\d\]$/.test(part) ? (
                <span
                  key={i}
                  className="mx-0.5 rounded-[2px] border border-primary bg-primary/10 px-1 text-[0.7rem] font-medium text-primary"
                >
                  {part.slice(1, -1)}
                </span>
              ) : (
                <span key={i}>{part}</span>
              ),
            )}
          </p>
          <div className="border-t border-border pt-3">
            <p className="font-mono text-[0.65rem] tracking-wider text-muted-foreground uppercase">
              {sourcesLabel}
            </p>
            <ul className="mt-1.5 space-y-1 font-mono text-xs text-muted-foreground">
              <li className="flex justify-between gap-3">
                <span>
                  <span className="text-primary">[1]</span> {source1}
                </span>
                <span className="text-relief">0.84</span>
              </li>
              <li className="flex justify-between gap-3">
                <span>
                  <span className="text-primary">[2]</span> {source2}
                </span>
                <span className="text-relief">0.81</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pipeline({
  title,
  subtitle,
  steps,
}: {
  title: string;
  subtitle: string;
  steps: { key: string; title: string; description: string; meta: string }[];
}) {
  const colors = ["text-chart-1", "text-chart-2", "text-chart-3", "text-chart-4"];
  return (
    <section className="border-t border-border bg-accent/40">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <SectionLabel>{title}</SectionLabel>
        <p className="mt-2 max-w-prose text-muted-foreground">{subtitle}</p>

        <ol className="mt-10 grid gap-x-6 gap-y-8 sm:grid-cols-4">
          {steps.map((step, i) => (
            <li key={step.key} className="relative flex gap-4 sm:flex-col sm:gap-4">
              {/* Connector to the next marker: markers sit on `bg-background`
                  and punch through the rail. `+1.5rem` bridges the grid gap. */}
              {i < steps.length - 1 && (
                <>
                  <span
                    aria-hidden="true"
                    className="absolute top-9 bottom-[-2rem] left-3.5 w-px bg-border sm:hidden"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute top-3.5 left-3.5 hidden h-px w-[calc(100%+1.5rem)] bg-border sm:block"
                  />
                </>
              )}
              <span
                className={
                  "z-10 flex size-7 shrink-0 items-center justify-center border-2 bg-background font-mono text-xs font-semibold " +
                  colors[i]
                }
                style={{ borderColor: "currentColor" }}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <h3 className="font-heading text-base font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                <p className="mt-2 font-mono text-[0.7rem] tracking-wide text-muted-foreground">
                  {step.meta}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-mono text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
      {children}
    </h2>
  );
}

function CompassMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
      <path d="M12 7l2.4 5-2.4 5-2.4-5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CornerTicks() {
  const base = "absolute h-2.5 w-2.5 border-primary";
  return (
    <span aria-hidden="true">
      <span className={`${base} -top-px -left-px border-t border-l`} />
      <span className={`${base} -top-px -right-px border-t border-r`} />
      <span className={`${base} -bottom-px -left-px border-b border-l`} />
      <span className={`${base} -right-px -bottom-px border-b border-r`} />
    </span>
  );
}

function asArray(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}
