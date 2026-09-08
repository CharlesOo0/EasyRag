import { forwardRef, useCallback, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, RotateCcw } from "lucide-react";

import type { ChatMessage, ChatSource, StreamErrorKind } from "./types";

const CITATION_RE = /\[(\d+)\]/g;
const HIGHLIGHT_MS = 1600;

export function MessageBubble({
  message,
  onRetry,
  canRetry,
}: {
  message: ChatMessage;
  onRetry: () => void;
  canRetry: boolean;
}) {
  const { t } = useTranslation();
  const isUser = message.role === "user";
  const sources = message.sources ?? [];

  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [highlighted, setHighlighted] = useState<number | null>(null);

  const jumpToSource = useCallback((n: number) => {
    const el = cardRefs.current[n - 1];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setHighlighted(n - 1);
    window.setTimeout(
      () => setHighlighted((current) => (current === n - 1 ? null : current)),
      HIGHLIGHT_MS,
    );
  }, []);

  const isEmptyDone =
    !isUser && !message.streaming && !message.content && !message.error && !message.stopped;
  const showRetry =
    !isUser &&
    canRetry &&
    (message.error || message.incomplete || message.stopped || isEmptyDone);
  const showSources = !isUser && !message.streaming && sources.length > 0;

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          "rounded-2xl px-4 py-2.5 text-sm max-w-[85%] " +
          (isUser ? "bg-primary text-primary-foreground" : "bg-secondary")
        }
      >
        <div className="whitespace-pre-wrap">
          {isUser ? message.content : renderWithCitations(message.content, sources.length, jumpToSource)}
          {message.streaming && message.content && (
            <span className="ml-0.5 animate-pulse">▋</span>
          )}
        </div>

        {message.streaming && !message.content && (
          <span className="text-muted-foreground">{t("chat.thinking")}</span>
        )}
        {message.stopped && (
          <span className="ml-1 text-muted-foreground text-xs">{t("chat.stopped")}</span>
        )}
        {message.incomplete && (
          <p className="mt-1 text-muted-foreground text-xs">{t("chat.incomplete")}</p>
        )}
        {isEmptyDone && (
          <span className="text-muted-foreground">{t("chat.emptyResponse")}</span>
        )}
        {message.error && (
          <p className="mt-1 text-destructive text-xs">{t(errorKey(message.error.kind))}</p>
        )}

        {showRetry && (
          <button
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-3 h-3" />
            {t("chat.retry")}
          </button>
        )}

        {showSources && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              {t("chat.sources", { count: sources.length })}
            </p>
            <div className="space-y-2">
              {sources.map((source, index) => (
                <SourceCard
                  key={index}
                  ref={(el) => {
                    cardRefs.current[index] = el;
                  }}
                  index={index}
                  source={source}
                  highlighted={highlighted === index}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Turn `[1]` / `[2]` markers that point at a real source into buttons. */
function renderWithCitations(
  content: string,
  sourceCount: number,
  onJump: (n: number) => void,
): ReactNode {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  CITATION_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = CITATION_RE.exec(content)) !== null) {
    const n = Number(match[1]);
    if (n < 1 || n > sourceCount) continue; // out of range: leave as plain text

    if (match.index > cursor) nodes.push(content.slice(cursor, match.index));
    nodes.push(
      <button
        key={`cite-${key++}`}
        type="button"
        onClick={() => onJump(n)}
        title={`Source ${n}`}
        className="mx-0.5 rounded bg-primary/10 px-1 align-baseline text-[0.7rem] font-medium text-primary hover:bg-primary/20"
      >
        {n}
      </button>,
    );
    cursor = match.index + match[0].length;
  }

  if (cursor < content.length) nodes.push(content.slice(cursor));
  return nodes.length ? nodes : content;
}

const SourceCard = forwardRef<
  HTMLDivElement,
  { index: number; source: ChatSource; highlighted: boolean }
>(({ index, source, highlighted }, ref) => {
  const percent = Math.round(source.similarity * 100);
  return (
    <div
      ref={ref}
      className={
        "rounded-lg border p-2.5 text-xs transition-colors " +
        (highlighted ? "border-primary bg-primary/5" : "border-border bg-background/50")
      }
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-foreground">
          <span className="text-primary">[{index + 1}]</span> {source.title}
        </span>
        <span className="shrink-0 text-muted-foreground" title="similarity">
          {percent}%
        </span>
      </div>
      <p className="mt-0.5 text-muted-foreground">{source.heading_path}</p>
      <p className="mt-1 line-clamp-3 text-muted-foreground">{source.snippet}</p>
      {source.source_url && (
        <a
          href={source.source_url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-primary hover:underline"
        >
          {hostOf(source.source_url)}
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
});
SourceCard.displayName = "SourceCard";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "source";
  }
}

function errorKey(kind: StreamErrorKind): string {
  return {
    network: "chat.error.network",
    throttled: "chat.error.throttled",
    server: "chat.error.server",
    "bad-request": "chat.error.badRequest",
  }[kind];
}
