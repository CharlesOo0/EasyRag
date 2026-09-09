import { useTranslation } from "react-i18next";
import { ExternalLink, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

import { useSourceViewer } from "./source-viewer";
import type { ChatMessage, ChatSource, StreamErrorKind } from "./types";

const CITATION_RE = /\[(\d+)\]/g;

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
  const { open } = useSourceViewer();
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
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          "rounded-2xl px-4 py-2.5 text-sm max-w-[85%] " +
          (isUser ? "bg-primary text-primary-foreground" : "bg-secondary")
        }
      >
        <div className="whitespace-pre-wrap">
          {isUser
            ? message.content
            : renderWithCitations(
                message.content,
                sources,
                (source) => open(source),
                (n) => t("chat.citation", { n }),
              )}
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
                  index={index}
                  source={source}
                  onOpen={() => open(source)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
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

function SourceCard({
  index,
  source,
  onOpen,
}: {
  index: number;
  source: ChatSource;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const percent = Math.round(source.similarity * 100);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full rounded-lg border border-border bg-background/50 p-2.5 text-left text-xs transition-colors hover:border-primary/50 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-foreground">
          <span className="text-primary">[{index + 1}]</span> {source.title}
        </span>
        <span className="shrink-0 text-muted-foreground" title={t("chat.similarity")}>
          {percent}%
        </span>
      </div>
      <p className="mt-0.5 text-muted-foreground">{source.heading_path}</p>
      <p className="mt-1 line-clamp-3 text-muted-foreground">{source.snippet}</p>
      {source.source_url && (
        <span className="mt-1 inline-flex items-center gap-1 text-primary">
          {hostOf(source.source_url)}
          <ExternalLink className="w-3 h-3" />
        </span>
      )}
    </button>
  );
}

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
