import { useCallback, useRef, useState } from "react";

import { streamChat } from "./api";
import type { ChatMessage, ChatTurn } from "./types";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

/**
 * Owns the message list and the send / stop / retry lifecycle for one chat
 * session. The assistant message is updated in place as `token` events arrive;
 * how the stream ended is written back once it resolves.
 */
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesRef = useRef(messages);
  const abortRef = useRef<AbortController | null>(null);

  // Keep a synchronous mirror so send()/retry() see the latest list.
  const commit = useCallback(
    (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      setMessages((prev) => {
        const next = updater(prev);
        messagesRef.current = next;
        return next;
      });
    },
    [],
  );

  // No abort-on-unmount: it fights React's StrictMode remount and would kill a
  // stream a mount effect just kicked off (/chat?q=... auto-send). A stream left
  // running after navigation finishes on its own; `stop()` covers explicit
  // cancellation while on the page.

  const run = useCallback(
    async (question: string, assistantId: string) => {
      const history: ChatTurn[] = messagesRef.current
        .filter((m) => m.content && !m.error && !m.stopped)
        .map((m) => ({ role: m.role, content: m.content }));
      // Drop the pending assistant turn we just added from the history.
      history.pop();

      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);

      try {
        const result = await streamChat(
          { question, history },
          {
            signal: controller.signal,
            onEvent: (event) => {
              if (event.type === "token") {
                commit((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: m.content + event.text } : m,
                  ),
                );
              } else if (event.type === "sources") {
                commit((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, sources: event.sources } : m)),
                );
              }
            },
          },
        );

        commit((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m;
            const base = { ...m, streaming: false };
            switch (result.status) {
              case "done":
                return base;
              case "aborted":
                return { ...base, stopped: true };
              case "incomplete":
                return { ...base, incomplete: true };
              case "error":
                return { ...base, error: { kind: result.kind, detail: result.detail } };
            }
          }),
        );
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [commit],
  );

  const send = useCallback(
    (raw: string) => {
      const question = raw.trim();
      if (!question || isStreaming) return;
      const assistantId = newId();
      commit((prev) => [
        ...prev,
        { id: newId(), role: "user", content: question },
        { id: assistantId, role: "assistant", content: "", streaming: true },
      ]);
      void run(question, assistantId);
    },
    [commit, isStreaming, run],
  );

  const retry = useCallback(
    (assistantId: string) => {
      if (isStreaming) return;
      const list = messagesRef.current;
      const index = list.findIndex((m) => m.id === assistantId);
      if (index < 1 || list[index - 1]?.role !== "user") return;
      const question = list[index - 1].content;

      const nextAssistantId = newId();
      commit((prev) => [
        ...prev.slice(0, index),
        { id: nextAssistantId, role: "assistant", content: "", streaming: true },
      ]);
      void run(question, nextAssistantId);
    },
    [commit, isStreaming, run],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    commit(() => []);
  }, [commit]);

  return { messages, isStreaming, send, retry, stop, reset };
}
