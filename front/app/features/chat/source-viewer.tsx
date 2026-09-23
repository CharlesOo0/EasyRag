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

import { fetchDocument } from "./documents";
import { Markdown } from "./markdown";
import type { ChatSource, CorpusDocument } from "./types";

const HIGHLIGHT_MS = 2600;

type SourceViewer = {
  source: ChatSource | null;
  open: (source: ChatSource) => void;
  close: () => void;
};

const SourceViewerContext = createContext<SourceViewer>({
  source: null,
  open: () => {},
  close: () => {},
});

export function useSourceViewer(): SourceViewer {
  return useContext(SourceViewerContext);
}

export function SourceViewerProvider({ children }: { children: ReactNode }) {
  const [source, setSource] = useState<ChatSource | null>(null);
  const open = useCallback((next: ChatSource) => setSource(next), []);
  const close = useCallback(() => setSource(null), []);

  return (
    <SourceViewerContext.Provider value={{ source, open, close }}>
      {children}
    </SourceViewerContext.Provider>
  );
}

type Fetch =
  | { state: "loading" }
  | { state: "ready"; doc: CorpusDocument }
  | { state: "error" };

/**
 * The cited document. From `lg` up it is a column beside the conversation; on
 * narrower screens there is no room for that, so it becomes a sheet over the
 * chat with a scrim.
 */
export function SourcePanel() {
  const { t } = useTranslation();
  const { source, close } = useSourceViewer();
  const [result, setResult] = useState<Fetch>({ state: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape.
  useEffect(() => {
    if (!source) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [source, close]);

  // Fetch the document for the active source.
  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    setResult({ state: "loading" });
    fetchDocument(source.slug).then(
      (doc) => !cancelled && setResult({ state: "ready", doc }),
      () => !cancelled && setResult({ state: "error" }),
    );
    return () => {
      cancelled = true;
    };
  }, [source, reloadKey]);

  // Once rendered, scroll to and briefly highlight the cited passage.
  useEffect(() => {
    if (!source || result.state !== "ready" || !scrollRef.current) return;
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

  if (!source) return null;

  const title = result.state === "ready" ? result.doc.title : source.title;
  const sourceUrl =
    (result.state === "ready" && stringMeta(result.doc.metadata, "source_url")) ||
    source.source_url;

  return (
    <div className="fixed inset-0 z-50 lg:static lg:z-auto lg:h-full lg:w-[24rem] lg:shrink-0 xl:w-[28rem]">
      <div onClick={close} className="absolute inset-0 bg-foreground/40 lg:hidden" />
      <aside
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-card lg:static lg:h-full lg:max-w-none"
        aria-label={title}
      >
        <header className="flex items-start gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-heading text-base font-semibold">{title}</h2>
            <p className="mt-0.5 truncate font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase">
              {source.heading_path}
            </p>
          </div>
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 shrink-0 font-mono text-[0.65rem] tracking-wide text-primary uppercase hover:underline"
            >
              {t("chat.source.viewOriginal")}
            </a>
          )}
          <button
            ref={closeButtonRef}
            onClick={close}
            aria-label={t("chat.source.close")}
            className="-mr-1 shrink-0 cursor-pointer rounded-sm px-1.5 py-0.5 font-mono text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            &times;
          </button>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {result.state === "loading" && (
            <p className="font-mono text-xs text-muted-foreground">{t("chat.source.loading")}</p>
          )}
          {result.state === "error" && (
            <div className="text-sm">
              <p className="font-mono text-xs text-destructive">{t("chat.source.error")}</p>
              <button
                onClick={() => setReloadKey((k) => k + 1)}
                className="mt-2 cursor-pointer font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                &#8635; {t("chat.retry")}
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
