import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";

import { EmptyState } from "~/features/chat/empty-state";
import { MessageTurn } from "~/features/chat/message";
import { SourcePanel, SourceViewerProvider } from "~/features/chat/source-viewer";
import { useChat } from "~/features/chat/hooks";

export function meta() {
  return [{ title: "EasyRag — Chat" }];
}

export default function ChatRoute() {
  return (
    <SourceViewerProvider>
      <div className="h-screen bg-background p-3 text-foreground sm:p-5 lg:p-6">
        <div className="mx-auto flex h-full max-w-6xl overflow-hidden rounded-sm border border-border bg-card">
          <Conversation />
          <SourcePanel />
        </div>
      </div>
    </SourceViewerProvider>
  );
}

function Conversation() {
  const { t, i18n } = useTranslation();
  const { messages, isStreaming, send, retry, stop } = useChat();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const autoSent = useRef(false);
  const other = i18n.language === "fr" ? "en" : "fr";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // A question passed from the landing page (/chat?q=...) - send it once.
  useEffect(() => {
    const q = searchParams.get("q");
    if (!q || autoSent.current) return;
    autoSent.current = true;
    send(q);
    setSearchParams({}, { replace: true });
  }, [searchParams, send, setSearchParams]);

  const submit = () => {
    if (!draft.trim() || isStreaming) return;
    send(draft);
    setDraft("");
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-4 sm:px-5">
        <Link
          to="/"
          className="flex items-center gap-2 font-heading text-base font-semibold tracking-tight transition-colors hover:text-primary"
        >
          <CompassMark className="h-4.5 w-4.5 text-primary" />
          <span>
            Easy<span className="text-primary">Rag</span>
          </span>
        </Link>

        <span className="hidden font-mono text-[0.65rem] tracking-[0.18em] text-muted-foreground uppercase md:block">
          {t("chat.title")}
        </span>

        <div className="flex items-center gap-3">
          <button
            onClick={() => i18n.changeLanguage(other)}
            className="cursor-pointer rounded-sm border border-transparent px-2 py-1 font-mono text-xs tracking-widest text-muted-foreground uppercase transition-colors hover:border-border hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label={t("chat.toggleLanguage")}
          >
            {other}
          </button>
          <Link
            to="/"
            className="font-mono text-xs tracking-wide text-muted-foreground transition-colors hover:text-foreground"
          >
            &larr; {t("chat.back")}
          </Link>
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-7 px-4 py-7 sm:px-6">
          {messages.length === 0 ? (
            <EmptyState onPick={send} />
          ) : (
            messages.map((message, i) => (
              <MessageTurn
                key={message.id}
                message={message}
                onRetry={() => retry(message.id)}
                canRetry={!isStreaming}
                showRule={i > 0 && message.role === "user"}
              />
            ))
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border py-3">
        <form
          className="mx-auto max-w-2xl px-4 sm:px-6"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex items-end gap-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder={t("chat.placeholder")}
              className="max-h-40 flex-1 resize-none rounded-sm border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            {isStreaming ? (
              <button
                type="button"
                onClick={stop}
                className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-sm border border-border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-accent"
              >
                <span aria-hidden="true" className="font-mono text-[0.7em]">
                  &#9632;
                </span>
                {t("chat.stop")}
              </button>
            ) : (
              <button
                type="submit"
                disabled={!draft.trim()}
                className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-sm bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("chat.send")}
                <span aria-hidden="true" className="font-mono">
                  &rarr;
                </span>
              </button>
            )}
          </div>
          <p className="mt-1.5 font-mono text-[0.65rem] tracking-wide text-muted-foreground">
            {t("chat.hint")}
          </p>
        </form>
      </div>
    </div>
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
