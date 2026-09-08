import { useCallback, useRef, useState } from "react";

import { streamChat } from "./api";
import type { ChatMessage, ChatTurn } from "./types";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

/**
 * Owns the message list and the send/stop lifecycle for one chat session.
 * The assistant message is updated in place as `token` events arrive.
 */
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const patchAssistant = useCallback((id: string, patch: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question || isStreaming) return;

      const history: ChatTurn[] = messages
        .filter((m) => m.content && !m.error)
        .map((m) => ({ role: m.role, content: m.content }));

      const userMessage: ChatMessage = { id: newId(), role: "user", content: question };
      const assistantId = newId();
      setMessages((prev) => [
        ...prev,
        userMessage,
        { id: assistantId, role: "assistant", content: "", streaming: true },
      ]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamChat(
          { question, history },
          {
            signal: controller.signal,
            onEvent: (event) => {
              switch (event.type) {
                case "token":
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId ? { ...m, content: m.content + event.text } : m,
                    ),
                  );
                  break;
                case "sources":
                  patchAssistant(assistantId, { sources: event.sources });
                  break;
                case "error":
                  patchAssistant(assistantId, { error: event.detail, streaming: false });
                  break;
                case "done":
                  patchAssistant(assistantId, { streaming: false });
                  break;
              }
            },
          },
        );
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          patchAssistant(assistantId, {
            error: err instanceof Error ? err.message : "Network error",
            streaming: false,
          });
        }
      } finally {
        patchAssistant(assistantId, { streaming: false });
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, isStreaming, patchAssistant],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
  }, []);

  return { messages, isStreaming, send, stop, reset };
}
