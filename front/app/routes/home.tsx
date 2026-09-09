import { Fragment } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import { CORPUS_INDEX } from "~/data/corpus-index";

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
const REPO_URL = "https://github.com/CharlesOo0/EasyRag";

const STEP_ACCENT = ["text-chart-1", "text-chart-2", "text-chart-3", "text-chart-4"];

const REGION_ORDER = [
  "africa",
  "europe",
  "east-n-southeast-asia",
  "central-america-n-caribbean",
  "middle-east",
  "australia-oceania",
  "south-america",
  "central-asia",
  "south-asia",
  "north-america",
] as const;

const REGION_LABEL: Record<string, { fr: string; en: string }> = {
  africa: { fr: "Afrique", en: "Africa" },
  europe: { fr: "Europe", en: "Europe" },
  "east-n-southeast-asia": { fr: "Asie de l'Est & du Sud-Est", en: "East & Southeast Asia" },
  "central-america-n-caribbean": {
    fr: "Amérique centrale & Caraïbes",
    en: "Central America & Caribbean",
  },
  "middle-east": { fr: "Moyen-Orient", en: "Middle East" },
  "australia-oceania": { fr: "Australie & Océanie", en: "Australia & Oceania" },
  "south-america": { fr: "Amérique du Sud", en: "South America" },
  "central-asia": { fr: "Asie centrale", en: "Central Asia" },
  "south-asia": { fr: "Asie du Sud", en: "South Asia" },
  "north-america": { fr: "Amérique du Nord", en: "North America" },
};

export default function Home() {
  const { t, i18n } = useTranslation();
  const other = i18n.language === "fr" ? "en" : "fr";
  const examples = asArray(t("home.tryIt.examples", { returnObjects: true }));

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <nav className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <span className="flex items-center gap-2 font-heading text-lg font-semibold tracking-tight">
            <CompassMark className="h-5 w-5 text-primary" />
            <span>
              Easy<span className="text-primary">Rag</span>
            </span>
          </span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => i18n.changeLanguage(other)}
              className="font-mono text-xs tracking-widest text-muted-foreground uppercase transition-colors hover:text-foreground"
              aria-label={t("home.toggleLanguage")}
            >
              {other}
            </button>
            <Link
              to="/chat"
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t("home.openChat")}
              <Arrow />
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        <section className="relative isolate overflow-hidden border-b border-border">
          <HeroContours />
          <div className="mx-auto grid max-w-5xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_25rem] lg:items-start lg:py-20">
            <div>
              <p className="flex items-center gap-3 font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
                <span className="h-px w-6 bg-current" />
                {t("home.hero.eyebrow")}
              </p>
              <h1 className="mt-5 font-heading text-[2.75rem] leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
                {t("home.hero.title")}
              </h1>
              <p className="mt-6 max-w-prose text-lg text-muted-foreground">
                {t("home.hero.subtitle")}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/chat"
                  className="inline-flex items-center justify-center gap-2 rounded-sm bg-primary px-5 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {t("home.openChat")}
                  <Arrow />
                </Link>
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-sm border border-border px-5 py-3 font-medium transition-colors hover:bg-accent"
                >
                  {t("home.viewSource")}
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
          </div>
        </section>

        <PipelineTrace />
        <Gazetteer />
        <Datasheet />

        <section className="border-t border-border">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
            <h2 className="font-heading text-2xl font-semibold sm:text-3xl">
              {t("home.tryIt.title")}
            </h2>
            <ul className="mt-6 flex flex-col gap-px overflow-hidden rounded-sm border border-border bg-border">
              {examples.map((q) => (
                <li key={q}>
                  <Link
                    to={`/chat?q=${encodeURIComponent(q)}`}
                    className="group flex items-center justify-between gap-4 bg-background px-4 py-3.5 transition-colors hover:bg-accent"
                  >
                    <span>{q}</span>
                    <span className="shrink-0 font-mono text-muted-foreground transition-colors group-hover:text-primary">
                      &rarr;
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              to="/chat"
              className="mt-6 inline-flex items-center gap-2 rounded-sm bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t("home.openChat")}
              <Arrow />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="text-sm text-muted-foreground">{t("home.footer")}</span>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs tracking-wider text-muted-foreground uppercase transition-colors hover:text-foreground"
          >
            github.com/CharlesOo0/EasyRag
          </a>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ plates */

function PlateHead({ n, title }: { n: string; title: string }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-border pb-2">
      <h2 className="font-heading text-2xl font-semibold sm:text-3xl">{title}</h2>
      <span className="shrink-0 pb-1 font-mono text-[0.7rem] tracking-[0.22em] text-muted-foreground uppercase">
        Pl.&nbsp;{n}
      </span>
    </div>
  );
}

/** Pl. I — one document's trace through the pipeline, each stage's real
 * artifact shown, not a feature card. */
function PipelineTrace() {
  const { t } = useTranslation();
  const stages = STEP_KEYS.map((key, i) => ({
    key,
    n: i + 1,
    accent: STEP_ACCENT[i],
    title: t(`home.pipeline.steps.${key}.title`),
    artifact: t(`home.pipeline.steps.${key}.artifact`),
    meta: t(`home.pipeline.steps.${key}.meta`),
  }));

  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <PlateHead n="I" title={t("home.pipeline.title")} />
        <p className="mt-4 max-w-prose text-muted-foreground">{t("home.pipeline.subtitle")}</p>
        <p className="mt-6 font-mono text-xs text-muted-foreground">{t("home.pipeline.trace")}</p>

        <ol className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-stretch">
          {stages.map((s, i) => (
            <Fragment key={s.key}>
              <li className="flex flex-1 flex-col">
                <div className="relative flex min-h-[7.5rem] flex-1 items-center border border-border bg-card p-3.5">
                  <span
                    className={`absolute -top-2.5 left-3 bg-background px-1 font-mono text-xs font-semibold ${s.accent}`}
                  >
                    {s.n}
                  </span>
                  <p className="font-mono text-[0.7rem] leading-relaxed break-words text-foreground/80">
                    {s.artifact}
                  </p>
                </div>
                <h3 className="mt-2.5 font-heading text-sm font-semibold">{s.title}</h3>
                <p className="mt-0.5 font-mono text-[0.7rem] tracking-wide text-muted-foreground">
                  {s.meta}
                </p>
              </li>
              {i < stages.length - 1 && (
                <span
                  aria-hidden="true"
                  className="self-center font-mono text-muted-foreground max-lg:rotate-90"
                >
                  &rarr;
                </span>
              )}
            </Fragment>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Pl. II — the corpus as a gazetteer: every profile, grouped by region. */
function Gazetteer() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "en" ? "en" : "fr";

  const byRegion = new Map<string, typeof CORPUS_INDEX>();
  for (const entry of CORPUS_INDEX) {
    const list = byRegion.get(entry.region) ?? [];
    list.push(entry);
    byRegion.set(entry.region, list);
  }

  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <PlateHead n="II" title={t("home.corpus.title")} />
        <p className="mt-4 max-w-prose text-muted-foreground">{t("home.corpus.body")}</p>

        <dl className="mt-8 border-t border-border">
          {REGION_ORDER.map((region) => {
            const items = byRegion.get(region) ?? [];
            if (!items.length) return null;
            return (
              <div
                key={region}
                className="grid gap-x-8 gap-y-1.5 border-b border-border py-3.5 sm:grid-cols-[14rem_1fr]"
              >
                <dt className="font-mono text-[0.7rem] tracking-[0.14em] text-muted-foreground uppercase">
                  {REGION_LABEL[region][lang]}
                  <span className="text-foreground/35"> · {items.length}</span>
                </dt>
                <dd className="text-sm leading-relaxed">
                  {items.map((c, i) => (
                    <span key={c.slug}>
                      {i > 0 && <span className="text-border"> · </span>}
                      {c.name}
                    </span>
                  ))}
                </dd>
              </div>
            );
          })}
        </dl>

        <p className="mt-4 font-mono text-xs text-muted-foreground">
          {CORPUS_INDEX.length} {t("home.corpus.statLabel")} &middot; {REGION_ORDER.length}{" "}
          {lang === "fr" ? "régions" : "regions"} &middot; CIA World Factbook
        </p>
      </div>
    </section>
  );
}

/** Pl. III — the stack as a datasheet, map-margin style. */
function Datasheet() {
  const { t } = useTranslation();
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <PlateHead n="III" title={t("home.stack.title")} />
        <dl className="mt-8 border-t border-border font-mono text-sm">
          {STACK_KEYS.map((key) => (
            <div
              key={key}
              className="grid items-baseline gap-x-6 gap-y-0.5 border-b border-border py-3.5 sm:grid-cols-[10rem_13rem_1fr]"
            >
              <dt className="text-[0.7rem] tracking-[0.14em] text-muted-foreground uppercase">
                {t(`home.stack.items.${key}.role`)}
              </dt>
              <dd className="text-foreground">{t(`home.stack.items.${key}.name`)}</dd>
              <dd className="text-muted-foreground">{t(`home.stack.items.${key}.spec`)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 max-w-prose text-sm text-muted-foreground">{t("home.stack.note")}</p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- fragments */

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
    <figure className="m-0 lg:mt-14">
      <div className="relative space-y-3 border border-border bg-card p-5 text-sm">
        <CornerTicks />
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
      <figcaption className="mt-2 border-t border-border pt-2 font-mono text-[0.7rem] tracking-wide text-muted-foreground">
        Fig.&nbsp;1 &mdash; {caption}
      </figcaption>
    </figure>
  );
}

function Arrow() {
  return (
    <span aria-hidden="true" className="font-mono">
      &rarr;
    </span>
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

function HeroContours() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full text-relief opacity-[0.11]"
      viewBox="0 0 1200 460"
      preserveAspectRatio="none"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.25">
        <path d="M-40 90 C 220 30 380 150 620 110 C 860 70 980 180 1240 120" />
        <path d="M-40 160 C 220 100 380 220 620 180 C 860 140 980 250 1240 190" />
        <path d="M-40 230 C 220 170 380 290 620 250 C 860 210 980 320 1240 260" />
        <path d="M-40 300 C 220 240 380 360 620 320 C 860 280 980 390 1240 330" />
        <path d="M-40 370 C 220 310 380 430 620 390 C 860 350 980 460 1240 400" />
      </g>
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
