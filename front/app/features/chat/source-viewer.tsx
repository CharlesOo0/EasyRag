import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, X } from "lucide-react";

import { fetchDocument } from "./documents";
import { Markdown } from "./markdown";
import type { ChatSource, CorpusDocument } from "./types";

const HIGHLIGHT_MS = 2600;
const EXIT_MS = 200;

type SourceViewer = { open: (source: ChatSource) => void };

const SourceViewerContext = createContext<SourceViewer>({ open: () => {} });

export function useSourceViewer(): SourceViewer {
  return useContext(SourceViewerContext);
}

export function SourceViewerProvider({ children }: { children: ReactNode }) {
  const [source, setSource] = useState<ChatSource | null>(null);
  const open = useCallback((next: ChatSource) => setSource(next), []);
  const close = useCallback(() => setSource(null), []);

  return (
    <SourceViewerContext.Provider value={{ open }}>
      {children}
      {source && <SourcePanel source={source} onClose={close} />}
    </SourceViewerContext.Provider>
  );
}

type Fetch =
  | { state: "loading" }
  | { state: "ready"; doc: CorpusDocument }
  | { state: "error" };

function SourcePanel({ source, onClose }: { source: ChatSource; onClose: () => void }) {
  const { t } = useTranslation();
  const [result, setResult] = useState<Fetch>({ state: "loading" });
  const [visible, setVisible] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const dismiss = useCallback(() => {
    setVisible(false);
    window.setTimeout(onClose, EXIT_MS);
  }, [onClose]);

  // Slide in on mount.
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    closeButtonRef.current?.focus();
    return () => cancelAnimationFrame(id);
  }, []);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismiss]);

  // Fetch the document for the active source.
  useEffect(() => {
    let cancelled = false;
    setResult({ state: "loading" });
    fetchDocument(source.slug).then(
      (doc) => !cancelled && setResult({ state: "ready", doc }),
      () => !cancelled && setResult({ state: "error" }),
    );
    return () => {
      cancelled = true;
    };
  }, [source.slug, reloadKey]);

  // Once rendered, scroll to and briefly highlight the cited passage.
  useEffect(() => {
    if (result.state !== "ready" || !scrollRef.current) return;
    const container = scrollRef.current;
    const target = findCitedElement(container, source);
    if (!target) return;

    target.scrollIntoView({ block: "start" });
    container.scrollBy({ top: -16 });

    const marks = sectionElements(target);
    marks.forEach((el) => el.classList.add("cited-passage"));
    const timer = window.setTimeout(
      () => marks.forEach((el) => el.classList.remove("cited-passage")),
      HIGHLIGHT_MS,
    );
    return () => {
      window.clearTimeout(timer);
      marks.forEach((el) => el.classList.remove("cited-passage"));
    };
  }, [result, source]);

  const title = result.state === "ready" ? result.doc.title : source.title;
  const sourceUrl =
    (result.state === "ready" && stringMeta(result.doc.metadata, "source_url")) ||
    source.source_url;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div
        onClick={dismiss}
        className={
          "absolute inset-0 bg-foreground/40 transition-opacity duration-200 motion-reduce:transition-none " +
          (visible ? "opacity-100" : "opacity-0")
        }
      />
      <aside
        className={
          "absolute inset-y-0 right-0 flex w-full flex-col border-l border-border bg-background shadow-xl transition-transform duration-200 ease-out motion-reduce:transition-none sm:max-w-xl lg:max-w-2xl " +
          (visible ? "translate-x-0" : "translate-x-full")
        }
      >
        <header className="flex items-start gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-heading text-base font-semibold">{title}</h2>
            <p className="mt-0.5 truncate font-mono text-[0.7rem] tracking-wide text-muted-foreground uppercase">
              {source.heading_path}
            </p>
          </div>
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
            >
              {t("chat.source.viewOriginal")}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button
            ref={closeButtonRef}
            onClick={dismiss}
            aria-label={t("chat.source.close")}
            className="-mr-1 shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {result.state === "loading" && (
            <p className="text-sm text-muted-foreground">{t("chat.source.loading")}</p>
          )}
          {result.state === "error" && (
            <div className="text-sm">
              <p className="text-destructive">{t("chat.source.error")}</p>
              <button
                onClick={() => setReloadKey((k) => k + 1)}
                className="mt-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {t("chat.retry")}
              </button>
            </div>
          )}
          {result.state === "ready" && (
            <Markdown className="text-sm text-foreground">{result.doc.body}</Markdown>
          )}
        </div>
      </aside>
    </div>
  );
}

/** The element the citation points at: the section heading whose text matches the
 * deepest segment of the chunk's heading path, else the first block containing
 * the snippet. */
function findCitedElement(container: HTMLElement, source: ChatSource): HTMLElement | null {
  const segments = source.heading_path
    .split(">")
    .map((s) => s.trim())
    .filter(Boolean);
  const deepest = segments[segments.length - 1]?.toLowerCase();

  if (deepest) {
    for (const h of container.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6")) {
      if (h.textContent?.trim().toLowerCase() === deepest) return h;
    }
  }

  const needle = source.snippet.replace(/\s+/g, " ").trim().slice(0, 40).toLowerCase();
  if (needle.length > 8) {
    for (const el of container.querySelectorAll<HTMLElement>("p,li,td,h1,h2,h3,h4")) {
      if (el.textContent?.replace(/\s+/g, " ").toLowerCase().includes(needle)) return el;
    }
  }
  return null;
}

/** A heading plus everything under it, up to the next heading of the same or a
 * higher level. A non-heading match highlights just itself. */
function sectionElements(start: HTMLElement): HTMLElement[] {
  const level = /^H([1-6])$/.exec(start.tagName)?.[1];
  if (!level) return [start];

  const els = [start];
  let el = start.nextElementSibling as HTMLElement | null;
  while (el) {
    const match = /^H([1-6])$/.exec(el.tagName);
    if (match && Number(match[1]) <= Number(level)) break;
    els.push(el);
    el = el.nextElementSibling as HTMLElement | null;
  }
  return els;
}

function stringMeta(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}
