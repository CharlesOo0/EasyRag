import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useTranslation } from "react-i18next";

import { CompassMark } from "~/components/marks";
import { fetchDocument } from "~/features/corpus/api";
import { Markdown } from "~/features/corpus/markdown";
import { regionLabel, regionOf } from "~/features/corpus/regions";
import type { CorpusDocument } from "~/features/corpus/types";

const REPO_URL = "https://github.com/CharlesOo0/EasyRag";

export function meta({ params }: { params: { slug?: string } }) {
  const title = humanizeSlug(params.slug ?? "");
  return [{ title: title ? `EasyRag — ${title}` : "EasyRag — Corpus" }];
}

type Fetch =
  | { state: "loading" }
  | { state: "ready"; doc: CorpusDocument }
  | { state: "error" };

export default function CorpusDocumentRoute() {
  const { slug = "" } = useParams();
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "en" ? "en" : "fr";
  const other = lang === "fr" ? "en" : "fr";
  const [result, setResult] = useState<Fetch>({ state: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setResult({ state: "loading" });
    fetchDocument(slug).then(
      (doc) => !cancelled && setResult({ state: "ready", doc }),
      () => !cancelled && setResult({ state: "error" }),
    );
    return () => {
      cancelled = true;
    };
  }, [slug, reloadKey]);

  // The tab title starts as a guess from the slug (see `meta`); correct it
  // once the real title is in.
  useEffect(() => {
    if (result.state === "ready") document.title = `EasyRag — ${result.doc.title}`;
  }, [result]);

  const region = result.state === "ready" ? regionOf(result.doc.metadata) : null;
  const sourceUrl = result.state === "ready" ? stringMeta(result.doc.metadata, "source_url") : "";
  const license = result.state === "ready" ? stringMeta(result.doc.metadata, "license") : "";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <nav className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
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
              to="/corpus"
              className="font-mono text-xs tracking-wide text-muted-foreground transition-colors hover:text-foreground"
            >
              &larr; {t("corpus.backToList")}
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          {result.state === "loading" && (
            <p className="font-mono text-sm text-muted-foreground">{t("corpus.detail.loading")}</p>
          )}

          {result.state === "error" && (
            <ErrorState slug={slug} onRetry={() => setReloadKey((k) => k + 1)} />
          )}

          {result.state === "ready" && (
            <article>
              <p className="flex items-center gap-2 font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
                <span className="h-px w-6 bg-current" />
                {region ? regionLabel(region, lang) : t("corpus.detail.eyebrow")}
              </p>
              <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                {result.doc.title}
              </h1>

              {(license || sourceUrl) && (
                <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.7rem] tracking-wide text-muted-foreground">
                  {license && <span>{license}</span>}
                  {sourceUrl && (
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary uppercase hover:underline"
                    >
                      {t("corpus.detail.viewOriginal")}
                    </a>
                  )}
                </p>
              )}

              <Markdown className="mt-8 text-foreground">{result.doc.body}</Markdown>
            </article>
          )}
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
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

function ErrorState({ slug, onRetry }: { slug: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div>
      <p className="flex items-center gap-2 font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
        <span className="h-px w-6 bg-current" />
        {t("corpus.detail.errorEyebrow")}
      </p>
      <h1 className="mt-3 font-heading text-3xl font-semibold">{t("corpus.detail.errorTitle")}</h1>
      <p className="mt-3 max-w-prose text-muted-foreground">{t("corpus.detail.errorBody")}</p>
      <p className="mt-2 font-mono text-xs text-muted-foreground">corpus/{slug}</p>
      <div className="mt-5 flex items-center gap-4">
        <Link
          to="/corpus"
          className="inline-flex items-center gap-2 rounded-sm bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t("corpus.backToList")}
        </Link>
        <button
          onClick={onRetry}
          className="cursor-pointer font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          &#8635; {t("corpus.retry")}
        </button>
      </div>
    </div>
  );
}

function humanizeSlug(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function stringMeta(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}
