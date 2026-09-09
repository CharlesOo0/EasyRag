import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { InlineMarkdown } from "./markdown";
import { useSourceViewer } from "./source-viewer";
import type { ChatMessage, ChatSource, StreamErrorKind } from "./types";

const CITATION_RE = /\[(\d+)\]/g;

/** One turn of the consultation: a speaker label, the text, and — for an
 * answer — the plates it was read from. */
export function MessageTurn({
  message,
  onRetry,
  canRetry,
  showRule,
}: {
  message: ChatMessage;
  onRetry: () => void;
  canRetry: boolean;
  showRule: boolean;
}) {
  const { t } = useTranslation();
  const { open } = useSourceViewer();
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const isUser = message.role === "user";
  const sources = message.sources ?? [];

  const isEmptyDone =
    !isUser && !message.streaming && !message.content && !message.error && !message.stopped;
  const showRetry =
    !isUser &&
    canRetry &&
    (message.error || message.incomplete || message.stopped || isEmptyDone);
  const showSources = !isUser && !message.streaming && sources.length > 0;

  return (
    <article className={showRule ? "border-t border-border pt-7" : undefined}>
      <p className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
        {isUser ? t("chat.you") : t("chat.assistant")}
      </p>

      {isUser ? (
        <p className="mt-2 border-l-2 border-primary/50 pl-3 whitespace-pre-wrap">
          {message.content}
        </p>
      ) : (
        <div className="mt-2 leading-relaxed whitespace-pre-wrap">
          {renderWithCitations(
            message.content,
            sources,
            (source) => open(source),
            (n) => t("chat.citation", { n }),
          )}
          {message.streaming && message.content && (
            <span className="ml-0.5 animate-pulse text-primary">▋</span>
          )}
        </div>
      )}

      {message.streaming && !message.content && (
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          {t("chat.thinking")}
          <span className="animate-pulse">…</span>
        </p>
      )}
      {message.stopped && (
        <p className="mt-2 font-mono text-xs text-muted-foreground">{t("chat.stopped")}</p>
      )}
      {message.incomplete && (
        <p className="mt-2 font-mono text-xs text-muted-foreground">{t("chat.incomplete")}</p>
      )}
      {isEmptyDone && (
        <p className="mt-2 font-mono text-xs text-muted-foreground">{t("chat.emptyResponse")}</p>
      )}
      {message.error && (
        <p className="mt-2 font-mono text-xs text-destructive">{t(errorKey(message.error.kind))}</p>
      )}

      {showRetry && (
        <button
          onClick={onRetry}
          className="mt-3 cursor-pointer font-mono text-xs tracking-wide text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          &#8635; {t("chat.retry")}
        </button>
      )}

      {showSources && (
        <div className="mt-5 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setSourcesOpen((v) => !v)}
            aria-expanded={sourcesOpen}
            className="flex cursor-pointer items-center gap-2 font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:text-foreground"
          >
            <span
              aria-hidden="true"
              className={
                "inline-block transition-transform duration-200 " +
                (sourcesOpen ? "rotate-90" : "")
              }
            >
              &#9656;
            </span>
            {t("chat.sources", { count: sources.length })}
          </button>

          {sourcesOpen && (
            <ul className="mt-1">
              {sources.map((source, index) => (
                <li key={index} className="border-b border-border/60 last:border-b-0">
                  <SourceEntry index={index} source={source} onOpen={() => open(source)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}

/** Turn `[1]` / `[2]` markers that point at a real source into buttons that open
 * that source in the viewer panel. */
function renderWithCitations(
  content: string,
  sources: ChatSource[],
  onOpen: (source: ChatSource) => void,
  titleFor: (n: number) => string,
): ReactNode {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  CITATION_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = CITATION_RE.exec(content)) !== null) {
    const n = Number(match[1]);
    if (n < 1 || n > sources.length) continue; // out of range: leave as plain text

    if (match.index > cursor) nodes.push(content.slice(cursor, match.index));
    nodes.push(
      <button
        key={`cite-${key++}`}
        type="button"
        onClick={() => onOpen(sources[n - 1])}
        title={titleFor(n)}
        className="mx-0.5 cursor-pointer rounded-[2px] border border-primary bg-primary/10 px-1 align-baseline font-mono text-[0.7rem] font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
      >
        {n}
      </button>,
    );
    cursor = match.index + match[0].length;
  }

  if (cursor < content.length) nodes.push(content.slice(cursor));
  return nodes.length ? nodes : content;
}

function SourceEntry({
  index,
  source,
  onOpen,
}: {
  index: number;
  source: ChatSource;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group block w-full cursor-pointer px-1 py-2.5 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 font-mono text-xs">
          <span className="text-primary">[{index + 1}]</span>{" "}
          <span className="text-foreground group-hover:text-primary">{source.heading_path}</span>
        </span>
        <span
          className="shrink-0 font-mono text-xs text-relief tabular-nums"
          title={t("chat.similarity")}
        >
          {source.similarity.toFixed(2)}
        </span>
      </span>
      <InlineMarkdown className="mt-1 line-clamp-3 block text-xs leading-snug text-muted-foreground [&_strong]:text-foreground/80">
        {snippetMarkdown(source.snippet)}
      </InlineMarkdown>
    </button>
  );
}

/** The Factbook chunks arrive as one long line — the chunker joins on spaces —
 * carrying their Markdown emphasis and a few HTML entities from the source
 * JSON. Decode the entities and turn the flattened list dashes into middots so
 * the preview renders as prose; the emphasis is left for the renderer. */
const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  agrave: "à", egrave: "è", igrave: "ì", ograve: "ò", ugrave: "ù",
  acirc: "â", ecirc: "ê", icirc: "î", ocirc: "ô", ucirc: "û",
  atilde: "ã", otilde: "õ", ntilde: "ñ", ccedil: "ç",
  auml: "ä", euml: "ë", iuml: "ï", ouml: "ö", uuml: "ü",
  aring: "å", oslash: "ø", aelig: "æ", szlig: "ß",
};

function snippetMarkdown(text: string): string {
  const cleaned = text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-zA-Z]+);/g, (whole, name: string) => ENTITIES[name.toLowerCase()] ?? whole)
    .replace(/\s+-\s+/g, " · ")
    .replace(/\s+/g, " ")
    .trim();

  // The snippet is a fixed slice of the chunk, so it can end mid-emphasis and
  // leave an unpaired `**` that would render literally. Drop the last one.
  const marks = cleaned.match(/\*\*/g)?.length ?? 0;
  if (marks % 2 === 0) return cleaned;
  const last = cleaned.lastIndexOf("**");
  return (cleaned.slice(0, last) + cleaned.slice(last + 2)).trim();
}

function errorKey(kind: StreamErrorKind): string {
  return {
    network: "chat.error.network",
    throttled: "chat.error.throttled",
    server: "chat.error.server",
    "bad-request": "chat.error.badRequest",
  }[kind];
}
