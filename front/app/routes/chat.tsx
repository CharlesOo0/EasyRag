import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Languages, Send, Square } from "lucide-react";

import { Button } from "~/components/ui/button";
import { useChat } from "~/features/chat/hooks";
import type { ChatMessage } from "~/features/chat/types";

export function meta() {
  return [{ title: "EasyRag — Chat" }];
}

export default function ChatRoute() {
  const { t, i18n } = useTranslation();
  const { messages, isStreaming, send, stop } = useChat();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const submit = () => {
    if (!draft.trim() || isStreaming) return;
    send(draft);
    setDraft("");
  };

  const toggleLanguage = () => i18n.changeLanguage(i18n.language === "fr" ? "en" : "fr");

  return (
    <div className="flex h-screen flex-col bg-background text-foreground font-sans">
      <header className="flex items-center justify-between border-b px-4 h-14 shrink-0">
        <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          {t("chat.back")}
        </Link>
        <span className="font-semibold">{t("chat.title")}</span>
        <button
          onClick={toggleLanguage}
          className="p-2 rounded-full hover:bg-secondary transition-colors"
          aria-label="Toggle language"
        >
          <Languages className="w-4 h-4" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
          {messages.length === 0 ? (
            <p className="text-center text-muted-foreground pt-20">{t("chat.empty")}</p>
          ) : (
            messages.map((message) => <MessageBubble key={message.id} message={message} />)
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

function MessageBubble({ message }: { message: ChatMessage }) {
  const { t } = useTranslation();
  const isUser = message.role === "user";

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          "rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap max-w-[85%] " +
          (isUser ? "bg-primary text-primary-foreground" : "bg-secondary")
        }
      >
        {message.content}
        {message.streaming && <span className="ml-0.5 animate-pulse">▋</span>}
        {message.streaming && !message.content && (
          <span className="text-muted-foreground">{t("chat.thinking")}</span>
        )}
        {message.error && (
          <p className="mt-1 text-destructive text-xs">
            {t("chat.errorPrefix")} {message.error}
          </p>
        )}
        {message.sources && message.sources.length > 0 && (
          <details className="mt-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">
              {t("chat.sources", { count: message.sources.length })}
            </summary>
            <ul className="mt-1 space-y-1">
              {message.sources.map((source, index) => (
                <li key={index}>
                  <span className="font-medium">[{index + 1}]</span> {source.heading_path}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
