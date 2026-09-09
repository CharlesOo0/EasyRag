import { Fragment, useState } from "react";
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
          <div className="flex items-center gap-3">
            <button
              onClick={() => i18n.changeLanguage(other)}
              className="rounded-sm border border-transparent px-2 py-1.5 font-mono text-xs tracking-widest text-muted-foreground uppercase transition-colors hover:border-border hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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

        <Expedition />
        <WorldPlate />
        <ShipPlate />

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

/* =============================================================== l'itinéraire
   The pipeline drawn as a treasure map: a dotted trail from the landing point,
   past the archive and the survey peak and the rose, to the X. */

const TRAIL =
  "M 80 320 C 102 338 132 300 154 322 C 164 322 170 318 178 316 " +
  "C 216 310 236 274 244 250 " +
  "C 252 226 288 214 320 224 C 352 234 372 226 396 208 C 404 202 410 198 415 195 " +
  "C 452 168 484 190 496 226 C 508 262 548 268 578 258 C 610 248 630 272 648 294 " +
  "C 651 297 653 299 655 300 C 700 322 748 306 782 268 C 812 234 842 176 878 132";

const COAST = "M 12 250 C 80 262 120 300 150 336 C 182 374 240 400 310 416 C 360 428 400 432 434 436";
const COAST_2 = "M 12 274 C 74 288 112 324 142 358 C 172 392 226 416 292 432";
const COAST_3 = "M 12 296 C 68 312 104 344 132 376 C 158 404 200 424 250 436";

const MARKS = [
  { x: 150, y: 292 },
  { x: 384, y: 162 },
  { x: 618, y: 264 },
  { x: 844, y: 98 },
];

function Expedition() {
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
        <h2 className="font-heading text-2xl font-semibold sm:text-3xl">
          {t("home.pipeline.title")}
        </h2>
        <p className="mt-3 max-w-prose text-muted-foreground">{t("home.pipeline.subtitle")}</p>
        <p className="mt-8 font-mono text-xs text-muted-foreground">{t("home.pipeline.trace")}</p>

        <svg
          viewBox="0 0 1000 440"
          className="mt-3 hidden w-full md:block"
          role="img"
          aria-label={t("home.pipeline.mapAlt")}
        >
          <defs>
            <clipPath id="expedition-plate">
              <rect x="12" y="12" width="976" height="416" />
            </clipPath>
          </defs>

          {/* the plate */}
          <rect x="4" y="4" width="992" height="432" className="fill-card stroke-border" strokeWidth="1" />
          <rect x="12" y="12" width="976" height="416" fill="none" className="stroke-border" strokeWidth="0.7" />

          {/* rhumb lines radiating from the rose, portolan-style */}
          <g clipPath="url(#expedition-plate)" className="stroke-foreground/10" strokeWidth="0.6">
            {Array.from({ length: 16 }, (_, i) => {
              const a = (i * 22.5 * Math.PI) / 180;
              return (
                <line
                  key={i}
                  x1={655}
                  y1={300}
                  x2={655 + 1300 * Math.cos(a)}
                  y2={300 + 1300 * Math.sin(a)}
                />
              );
            })}
          </g>

          {/* inland relief */}
          <g clipPath="url(#expedition-plate)" fill="none" className="stroke-foreground/30" strokeWidth="0.9">
            <path d="M 62 148 L 104 96 L 140 148 Z M 122 148 L 156 108 L 186 148 Z M 168 148 L 196 116 L 222 148 Z" className="fill-card" />
            <path d="M 104 96 L 96 118 M 104 96 L 114 118 M 156 108 L 150 126 M 156 108 L 164 126" strokeWidth="0.5" />
            <path d="M 806 362 L 836 326 L 862 362 Z M 852 362 L 878 332 L 902 362 Z" className="fill-card" />
          </g>

          {/* scale bar */}
          <g className="stroke-foreground/50" strokeWidth="0.9">
            <path d="M 782 404 L 782 396 M 782 400 L 934 400 M 934 404 L 934 396" fill="none" />
            <rect x="782" y="397" width="38" height="6" className="fill-foreground/50" stroke="none" />
            <rect x="858" y="397" width="38" height="6" className="fill-foreground/50" stroke="none" />
          </g>

          {/* sea, coast and its hachures */}
          <g fill="none" className="stroke-foreground/45" strokeWidth="1.1">
            <path d={COAST} />
          </g>
          <g fill="none" className="stroke-foreground/20" strokeWidth="0.8">
            <path d={COAST_2} />
            <path d={COAST_3} />
          </g>
          <g fill="none" className="stroke-foreground/25" strokeWidth="0.9">
            <path d="M 60 388 q 10 -7 20 0 M 96 412 q 10 -7 20 0 M 150 424 q 10 -7 20 0 M 40 350 q 10 -7 20 0" />
          </g>

          {/* sea serpent */}
          <g fill="none" className="stroke-foreground/45" strokeWidth="1.4">
            <path d="M 168 408 q 16 -20 32 0 q 16 -20 32 0" />
            <path d="M 232 408 q 13 -8 22 -19 q 6 -8 16 -4" />
            <path d="M 270 385 l 9 -3 l -4 8 Z" className="fill-foreground/45" />
            <circle cx="266" cy="386" r="1.6" className="fill-foreground/45" stroke="none" />
          </g>

          {/* forests */}
          <g fill="none" className="stroke-foreground/30" strokeWidth="0.9">
            {[
              [286, 152],
              [300, 162],
              [314, 150],
              [520, 112],
              [536, 122],
              [552, 110],
              [730, 204],
              [746, 214],
              [566, 356],
              [582, 348],
              [346, 356],
              [362, 366],
              [900, 236],
              [916, 246],
            ].map(([x, y]) => (
              <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
                <path d="M 0 6 L 0 0" />
                <path d="M -6 0 L 0 -13 L 6 0 Z" className="fill-card" />
              </g>
            ))}
          </g>

          {/* the trail */}
          <path
            d={TRAIL}
            fill="none"
            className="stroke-foreground/65"
            strokeWidth="2.6"
            strokeDasharray="1.5 9"
            strokeLinecap="round"
          />

          {/* the landing ship */}
          <g transform="translate(80 320)" className="stroke-foreground" strokeWidth="1.2" fill="none">
            <path d="M -19 4 Q 0 17 19 2 Q 0 9 -19 4 Z" className="fill-card" />
            <path d="M 0 3 L 0 -21" />
            <path d="M 1 -19 L 15 -11 L 1 -5 Z" className="fill-background" />
          </g>

          {/* 1 — the archive */}
          <g transform="translate(178 316)" className="stroke-foreground" strokeWidth="1.1" fill="none">
            <path d="M -19 9 L 19 9" />
            <path d="M -14 9 L -14 -5 M -7 9 L -7 -5 M 0 9 L 0 -5 M 7 9 L 7 -5 M 14 9 L 14 -5" strokeWidth="0.9" />
            <path d="M -19 -5 L 19 -5" />
            <path d="M -20 -5 L 0 -20 L 20 -5 Z" className="fill-card" />
          </g>

          {/* 2 — the survey peak */}
          <g transform="translate(415 195)" className="stroke-foreground" strokeWidth="1.1" fill="none">
            <path d="M 2 16 L 22 -6 L 38 16 Z" className="fill-card" />
            <path d="M -32 16 L -8 -16 L 14 16 Z" className="fill-card" />
            <path d="M -8 -16 L -13 -3 M -8 -16 L -3 -3 M -8 -16 L -20 6 M -8 -16 L 4 6" strokeWidth="0.55" />
            <path d="M -8 -16 L -8 -30" />
            <path d="M -8 -30 L 5 -26 L -8 -22 Z" className="fill-primary" stroke="none" />
          </g>

          {/* 3 — the compass rose */}
          <g transform="translate(655 300)" className="stroke-foreground" fill="none">
            <circle r="31" strokeWidth="0.9" className="fill-card" />
            <circle r="22" strokeWidth="0.55" />
            <path d="M -15 -15 L 3 -3 L 15 15 L -3 3 Z" strokeWidth="0.7" />
            <path d="M 15 -15 L 3 3 L -15 15 L -3 -3 Z" strokeWidth="0.7" />
            <path d="M -31 0 L 0 5 L 31 0 L 0 -5 Z" strokeWidth="0.9" />
            <path d="M 0 -31 L 5 0 L 0 31 L -5 0 Z" strokeWidth="0.9" />
            <path d="M 0 -31 L 5 0 L 0 0 Z" className="fill-foreground" stroke="none" />
            <circle r="2.4" className="fill-foreground" stroke="none" />
          </g>

          {/* 4 — X marks the spot */}
          <g transform="translate(878 132)">
            <circle r="27" fill="none" className="stroke-primary" strokeWidth="0.8" strokeDasharray="3 4" />
            <path
              d="M -15 -15 L 15 15 M 15 -15 L -15 15"
              className="stroke-primary"
              strokeWidth="3.6"
              strokeLinecap="round"
            />
          </g>

          {/* station numbers */}
          {MARKS.map((m, i) => (
            <g key={i} className={STEP_ACCENT[i]}>
              <circle cx={m.x} cy={m.y} r="9.5" className="fill-background" stroke="currentColor" strokeWidth="1.4" />
              <text
                x={m.x}
                y={m.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="11"
                fontWeight="600"
                className="fill-current font-mono"
              >
                {i + 1}
              </text>
            </g>
          ))}

          {/* landmark labels */}
          <g
            className="fill-muted-foreground font-mono"
            fontSize="11"
            letterSpacing="1"
            textAnchor="middle"
          >
            <text x="178" y="356">{stages[0].title}</text>
            <text x="415" y="242">{stages[1].title}</text>
            <text x="655" y="358">{stages[2].title}</text>
            <text x="878" y="188">{stages[3].title}</text>
          </g>
        </svg>

        <ol className="mt-8 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {stages.map((s) => (
            <li key={s.key}>
              <div className="flex items-baseline gap-2">
                <span className={`font-mono text-xs font-semibold ${s.accent}`}>{s.n}</span>
                <h3 className="font-heading text-base font-semibold">{s.title}</h3>
              </div>
              <p className="mt-2 border-l border-border pl-3 font-mono text-[0.7rem] leading-relaxed break-words text-foreground/75">
                {s.artifact}
              </p>
              <p className="mt-2 font-mono text-[0.7rem] tracking-wide text-muted-foreground">
                {s.meta}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ==================================================================== la carte
   Every profile plotted at its real Factbook coordinates. Hovering a region in
   the legend lights up its countries. */

const MAP_W = 1000;
const MAP_H = 380;
const LAT_TOP = 72;
const LAT_SPAN = 122; // down to -50

const project = (lat: number, lon: number) => ({
  x: ((lon + 180) / 360) * MAP_W,
  y: ((LAT_TOP - lat) / LAT_SPAN) * MAP_H,
});

function WorldPlate() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "en" ? "en" : "fr";
  const [active, setActive] = useState<string | null>(null);

  const counts = new Map<string, number>();
  for (const c of CORPUS_INDEX) counts.set(c.region, (counts.get(c.region) ?? 0) + 1);

  const meridians = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
  const parallels = [60, 40, 20, 0, -20, -40];

  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <h2 className="font-heading text-2xl font-semibold sm:text-3xl">
          {t("home.corpus.title")}
        </h2>
        <p className="mt-3 max-w-prose text-muted-foreground">{t("home.corpus.body")}</p>

        <figure className="m-0 mt-8">
          <svg
            viewBox={`0 0 ${MAP_W} ${MAP_H}`}
            className="w-full"
            role="img"
            aria-label={t("home.corpus.mapAlt")}
          >
            <rect
              x="0.5"
              y="0.5"
              width={MAP_W - 1}
              height={MAP_H - 1}
              fill="none"
              strokeWidth="1"
              className="stroke-border"
            />
            <g className="stroke-border" strokeWidth="0.75" opacity="0.7">
              {meridians.map((lon) => {
                const { x } = project(0, lon);
                return <line key={`m${lon}`} x1={x} y1="0" x2={x} y2={MAP_H} />;
              })}
              {parallels.map((lat) => {
                const { y } = project(lat, 0);
                return (
                  <line
                    key={`p${lat}`}
                    x1="0"
                    y1={y}
                    x2={MAP_W}
                    y2={y}
                    strokeWidth={lat === 0 ? "1.2" : "0.75"}
                  />
                );
              })}
            </g>
            <g className="stroke-foreground/60" strokeWidth="1">
              {meridians.map((lon) => {
                const { x } = project(0, lon);
                return (
                  <Fragment key={`t${lon}`}>
                    <line x1={x} y1="0" x2={x} y2="6" />
                    <line x1={x} y1={MAP_H} x2={x} y2={MAP_H - 6} />
                  </Fragment>
                );
              })}
              {parallels.map((lat) => {
                const { y } = project(lat, 0);
                return (
                  <Fragment key={`u${lat}`}>
                    <line x1="0" y1={y} x2="6" y2={y} />
                    <line x1={MAP_W} y1={y} x2={MAP_W - 6} y2={y} />
                  </Fragment>
                );
              })}
            </g>
            {CORPUS_INDEX.map((c) => {
              const { x, y } = project(c.lat, c.lon);
              const on = active === c.region;
              return (
                <circle
                  key={c.slug}
                  cx={x}
                  cy={y}
                  r={on ? 4.5 : 3}
                  className={
                    "transition-all duration-200 " +
                    (on ? "fill-primary" : active ? "fill-foreground/20" : "fill-foreground/55")
                  }
                >
                  <title>{c.name}</title>
                </circle>
              );
            })}
          </svg>
          <figcaption className="mt-2 border-t border-border pt-2 font-mono text-[0.7rem] tracking-wide text-muted-foreground">
            {t("home.corpus.mapCaption")}
          </figcaption>
        </figure>

        <ul className="mt-6 grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {REGION_ORDER.map((region) => (
            <li key={region}>
              <button
                type="button"
                onMouseEnter={() => setActive(region)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(region)}
                onBlur={() => setActive(null)}
                className={
                  "flex w-full items-baseline gap-2 border-b border-border/70 py-1.5 text-left font-mono text-[0.7rem] tracking-wide uppercase transition-colors focus-visible:outline-none " +
                  (active === region ? "text-primary" : "text-muted-foreground hover:text-foreground")
                }
              >
                <span
                  className={
                    "inline-block h-1.5 w-1.5 shrink-0 rounded-full transition-colors " +
                    (active === region ? "bg-primary" : "bg-foreground/40")
                  }
                />
                <span className="flex-1">{REGION_LABEL[region][lang]}</span>
                <span className="tabular-nums">{counts.get(region) ?? 0}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* =================================================================== le navire
   The stack as the vessel that carries the voyage: hold, instruments, log. */

function ShipPlate() {
  const { t } = useTranslation();
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <h2 className="font-heading text-2xl font-semibold sm:text-3xl">
          {t("home.stack.title")}
        </h2>
        <p className="mt-3 max-w-prose text-muted-foreground">{t("home.stack.note")}</p>

        <svg viewBox="0 0 1000 340" className="mt-8 w-full" aria-hidden="true">
          <g className="stroke-foreground" fill="none" strokeWidth="1.3" strokeLinejoin="round">
            {/* rigging — kept to a few stays so nothing crosses a sail */}
            <g strokeWidth="0.7" opacity="0.5">
              <path d="M 530 34 L 350 64 M 530 34 L 710 88 M 350 64 L 118 156 M 710 88 L 862 168" />
            </g>
            {/* masts */}
            <path d="M 350 208 L 350 60 M 530 216 L 530 30 M 710 205 L 710 86" />
            {/* yards */}
            <g strokeWidth="0.9">
              <path d="M 292 90 L 408 90 M 460 56 L 600 56 M 460 140 L 600 140 M 657 110 L 763 110" />
            </g>
            {/* square sails: straight on the yard, bellied at the foot */}
            <g className="fill-background" strokeWidth="1.1">
              <path d="M 300 90 L 400 90 L 400 152 Q 350 172 300 152 Z" />
              <path d="M 470 56 L 590 56 L 590 124 Q 530 146 470 124 Z" />
              <path d="M 470 140 L 590 140 L 590 206 Q 530 228 470 206 Z" />
              <path d="M 665 110 L 755 110 L 755 166 Q 710 184 665 166 Z" />
            </g>
            {/* hull — a lens between sheer and keel, cut by the waterline */}
            <path d="M 200 192 Q 530 216 860 180 Q 530 296 200 192 Z" className="fill-card" />
            <path d="M 228 200 Q 530 224 832 190" strokeWidth="0.9" />
            {/* stern castle */}
            <path d="M 786 154 L 862 148 L 858 182 Q 822 190 790 190 Z" className="fill-card" />
            {/* gun ports */}
            <g strokeWidth="0.85">
              {[
                [300, 216],
                [360, 220],
                [420, 223],
                [480, 225],
                [540, 225],
                [600, 224],
                [660, 221],
                [720, 216],
              ].map(([x, y]) => (
                <rect key={x} x={x} y={y} width="12" height="9" />
              ))}
            </g>
            {/* bowsprit + jib */}
            <path d="M 200 192 L 110 156" />
            <path d="M 132 166 L 200 196 L 200 146 Z" className="fill-background" strokeWidth="1.1" />
            {/* flag */}
            <path d="M 530 30 L 574 42 L 530 54 Z" className="fill-primary" stroke="none" />
            {/* the sextant, on deck */}
            <g transform="translate(624 198)" strokeWidth="1.1">
              <circle r="11" className="fill-background" />
              <path d="M 0 -11 L 3 0 L 0 11 L -3 0 Z" className="fill-foreground" strokeWidth="0.6" />
              <path d="M -11 0 L 0 2.5 L 11 0 L 0 -2.5 Z" strokeWidth="0.6" />
            </g>
          </g>

          {/* sea */}
          <g className="stroke-border" strokeWidth="1" fill="none">
            <line x1="40" y1="262" x2="960" y2="262" strokeDasharray="10 7" />
            <path d="M 120 282 q 15 -8 30 0 M 300 290 q 15 -8 30 0 M 690 288 q 15 -8 30 0 M 880 278 q 15 -8 30 0" />
          </g>

          {/* callouts */}
          <g className="stroke-border" strokeWidth="1" strokeDasharray="3 4" fill="none">
            <path d="M 300 246 L 300 306 L 30 306 L 30 336" />
            <path d="M 624 215 L 624 306 L 363 306 L 363 336" />
            <path d="M 824 186 L 824 306 L 696 306 L 696 336" />
          </g>
          <g className="fill-background stroke-primary" strokeWidth="1.5">
            <circle cx="300" cy="240" r="4.5" />
            <circle cx="624" cy="209" r="4.5" />
            <circle cx="824" cy="180" r="4.5" />
          </g>
        </svg>

        <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-3">
          {STACK_KEYS.map((key) => (
            <div key={key}>
              <dt className="font-mono text-[0.7rem] tracking-[0.16em] text-primary uppercase">
                {t(`home.stack.items.${key}.part`)}
              </dt>
              <dd className="mt-1.5 font-mono text-sm text-foreground">
                {t(`home.stack.items.${key}.name`)}
              </dd>
              <dd className="mt-0.5 font-mono text-[0.7rem] text-muted-foreground">
                {t(`home.stack.items.${key}.spec`)}
              </dd>
            </div>
          ))}
        </dl>
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
