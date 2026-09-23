import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import { CompassMark, Contours } from "~/components/marks";
import { fetchDocuments } from "~/features/corpus/api";
import { regionLabel, regionOf, REGION_ORDER } from "~/features/corpus/regions";
import type { CorpusDocumentSummary } from "~/features/corpus/types";

const REPO_URL = "https://github.com/CharlesOo0/EasyRag";
const KNOWN_REGIONS: readonly string[] = REGION_ORDER;

export function meta() {
  return [
    { title: "EasyRag — Corpus" },
    {
      name: "description",
      content: "Browse the 195 country profiles the corpus is built from.",
    },
  ];
}

type Fetch =
  | { state: "loading" }
  | { state: "ready"; documents: CorpusDocumentSummary[] }
  | { state: "error" };

type Entry = CorpusDocumentSummary & { region: string | null };

export default function CorpusRoute() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "en" ? "en" : "fr";
  const other = lang === "fr" ? "en" : "fr";
  const [result, setResult] = useState<Fetch>({ state: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");
  const [activeRegion, setActiveRegion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResult({ state: "loading" });
    fetchDocuments().then(
      (documents) => !cancelled && setResult({ state: "ready", documents }),
      () => !cancelled && setResult({ state: "error" }),
    );
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const documents = result.state === "ready" ? result.documents : [];

  const entries: Entry[] = useMemo(
    () => documents.map((d) => ({ ...d, region: regionOf(d.metadata) })),
    [documents],
  );
  const hasRegions = entries.some((d) => d.region);

  const regionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) if (e.region) counts.set(e.region, (counts.get(e.region) ?? 0) + 1);
    return counts;
  }, [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (activeRegion && e.region !== activeRegion) return false;
      if (!q) return true;
      const code = stringMeta(e.metadata, "country_code").toLowerCase();
      return e.title.toLowerCase().includes(q) || code === q;
    });
  }, [entries, query, activeRegion]);

  const groups = useMemo(() => {
    if (!hasRegions) return [{ key: null as string | null, items: filtered }];

    const byRegion = new Map<string, Entry[]>();
    for (const e of filtered) {
      const key = e.region ?? "";
      const list = byRegion.get(key) ?? [];
      list.push(e);
      byRegion.set(key, list);
    }

    const ordered: { key: string | null; items: Entry[] }[] = [];
    for (const region of REGION_ORDER) {
      const items = byRegion.get(region);
      if (items?.length) ordered.push({ key: region, items });
    }
    // A region this corpus invented, outside the Factbook's set - keep it visible.
    for (const [key, items] of byRegion) {
      if (key && !KNOWN_REGIONS.includes(key) && items.length) {
        ordered.push({ key, items });
      }
    }
    return ordered;
  }, [filtered, hasRegions]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <nav className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2 font-heading text-lg font-semibold tracking-tight transition-colors hover:text-primary"
          >
            <CompassMark className="h-5 w-5 text-primary" />
            <span>
              Easy<span className="text-primary">Rag</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={() => i18n.changeLanguage(other)}
              className="cursor-pointer rounded-sm border border-transparent px-2 py-1.5 font-mono text-xs tracking-widest text-muted-foreground uppercase transition-colors hover:border-border hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={t("corpus.toggleLanguage")}
            >
              {other}
            </button>
            <Link
              to="/chat"
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t("corpus.openChat")}
              <span aria-hidden="true" className="font-mono">
                &rarr;
              </span>
            </Link>
          </div>
        </div>
      </nav>

      <header className="relative isolate overflow-hidden border-b border-border">
        <Contours />
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <p className="flex items-center gap-3 font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
            <span className="h-px w-6 bg-current" />
            {t("corpus.eyebrow")}
          </p>
          <h1 className="mt-5 font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {t("corpus.title")}
          </h1>
          <p className="mt-4 max-w-prose text-muted-foreground">{t("corpus.subtitle")}</p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder={t("corpus.searchPlaceholder")}
            />
            <p className="font-mono text-xs tracking-wide text-muted-foreground tabular-nums">
              {t("corpus.count", { count: filtered.length })}
            </p>
          </div>

          {hasRegions && (
            <div className="mt-5 flex flex-wrap gap-2">
              <RegionToggle active={activeRegion === null} onClick={() => setActiveRegion(null)}>
                {t("corpus.allRegions")}
                <span className="text-current/60"> · {documents.length}</span>
              </RegionToggle>
              {REGION_ORDER.filter((r) => regionCounts.get(r)).map((region) => (
                <RegionToggle
                  key={region}
                  active={activeRegion === region}
                  onClick={() => setActiveRegion(activeRegion === region ? null : region)}
                >
                  {regionLabel(region, lang)}
                  <span className="text-current/60"> · {regionCounts.get(region)}</span>
                </RegionToggle>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          {result.state === "loading" && (
            <p className="font-mono text-sm text-muted-foreground">{t("corpus.loading")}</p>
          )}

          {result.state === "error" && (
            <div>
              <p className="font-mono text-sm text-destructive">{t("corpus.loadError")}</p>
              <button
                onClick={() => setReloadKey((k) => k + 1)}
                className="mt-2 cursor-pointer font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                &#8635; {t("corpus.retry")}
              </button>
            </div>
          )}

          {result.state === "ready" && filtered.length === 0 && (
            <p className="font-mono text-sm text-muted-foreground">
              {query.trim() ? t("corpus.noResultsFor", { query }) : t("corpus.noResults")}
            </p>
          )}

          {result.state === "ready" && filtered.length > 0 && (
            <div className="space-y-10">
              {groups.map((group) => (
                <section key={group.key ?? "__flat__"}>
                  {group.key && (
                    <h2 className="border-b border-border pb-2 font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">
                      {regionLabel(group.key, lang)}
                      <span className="text-foreground/35"> · {group.items.length}</span>
                    </h2>
                  )}
                  <ul
                    className={
                      "grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3 " + (group.key ? "mt-1" : "")
                    }
                  >
                    {group.items.map((doc) => (
                      <li key={doc.slug} className="border-b border-border/60">
                        <Link
                          to={`/corpus/${doc.slug}`}
                          className="group flex items-baseline justify-between gap-3 py-2 transition-colors hover:text-primary"
                        >
                          <span className="truncate text-sm">{doc.title}</span>
                          <span className="shrink-0 font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase group-hover:text-primary">
                            {stringMeta(doc.metadata, "country_code")}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="text-sm text-muted-foreground">{t("corpus.footer")}</span>
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

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full max-w-xs">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-sm border border-input bg-card px-3 py-2 pr-8 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear"
          className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer px-1 font-mono text-muted-foreground hover:text-foreground"
        >
          &times;
        </button>
      )}
    </div>
  );
}

function RegionToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "cursor-pointer rounded-sm border px-2.5 py-1 font-mono text-[0.7rem] tracking-wide uppercase transition-colors " +
        (active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

function stringMeta(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}
