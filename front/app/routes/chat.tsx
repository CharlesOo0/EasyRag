import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Languages, Send, Square } from "lucide-react";

import { Button } from "~/components/ui/button";
import { EmptyState } from "~/features/chat/empty-state";
import { MessageBubble } from "~/features/chat/message";
import { useChat } from "~/features/chat/hooks";

export function meta() {
  return [{ title: "EasyRag — Chat" }];
}

export default function ChatRoute() {
  const { t, i18n } = useTranslation();
  const { messages, isStreaming, send, retry, stop } = useChat();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const autoSent = useRef(false);

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

  const toggleLanguage = () => i18n.changeLanguage(i18n.language === "fr" ? "en" : "fr");

  return (
    <div className="flex h-screen flex-col bg-background text-foreground font-sans">
      <header className="flex items-center justify-between border-b px-4 h-14 shrink-0">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("chat.back")}
        </Link>
        <span className="font-semibold">{t("chat.title")}</span>
        <button
          onClick={toggleLanguage}
          className="p-2 rounded-full hover:bg-secondary transition-colors"
          aria-label={t("chat.toggleLanguage")}
        >
          <Languages className="w-4 h-4" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
          {messages.length === 0 ? (
            <EmptyState onPick={send} />
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onRetry={() => retry(message.id)}
                canRetry={!isStreaming}
              />
            ))
          )}
        </div>
      </div>

      <div className="border-t px-4 py-3 shrink-0">
        <form
          className="mx-auto max-w-2xl flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
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
            className="flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 max-h-40"
          />
          {isStreaming ? (
            <Button type="button" variant="outline" size="lg" onClick={stop}>
              <Square className="w-4 h-4" />
              {t("chat.stop")}
            </Button>
          ) : (
            <Button type="submit" size="lg" disabled={!draft.trim()}>
              <Send className="w-4 h-4" />
              {t("chat.send")}
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
