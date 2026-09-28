import { useCallback, useRef, useState } from "react";

import { streamChat } from "./api";
import { MAX_QUESTION_CHARS, type ChatEvent, type ChatMessage, type ChatTurn } from "./types";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

// The guardian itself estimates "~1-3 minutes" to boot (docs/azure-deployment-
// plan.md). Give real margin over that before giving up and asking the user
// to retry by hand - a wedged VM shouldn't retry silently forever either.
const MAX_WAKING_SECONDS = 240;

/** Resolves after `ms`, or immediately if `signal` aborts first - so Stop
 * interrupts a wait-to-retry-waking pause instantly instead of after the
 * full delay. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

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
      let wakingElapsed = 0;

      const onEvent = (event: ChatEvent) => {
        // Real events only ever arrive once the guardian has proxied through
        // to a live backend - clear any lingering "waking" state right away
        // instead of waiting for the stream to fully finish (`sources` is
        // the first event of a real response, arriving before any token).
        if (event.type === "token") {
          commit((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + event.text, waking: undefined } : m,
            ),
          );
        } else if (event.type === "sources") {
          commit((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, sources: event.sources, waking: undefined } : m,
            ),
          );
        }
      };

      try {
        // Loops only for "waking": wait retryAfter seconds, ask again with
        // the exact same question - not a recursive call, so isStreaming
        // and abortRef stay put for the whole wait, and Stop keeps working.
        while (true) {
          const result = await streamChat({ question, history }, { signal: controller.signal, onEvent });

          if (result.status === "waking") {
            commit((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, waking: { reason: result.reason } } : m,
              ),
            );
            wakingElapsed += result.retryAfter;
            if (wakingElapsed > MAX_WAKING_SECONDS) {
              commit((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        streaming: false,
                        waking: undefined,
                        error: { kind: "waking-timeout", detail: "" },
                      }
                    : m,
                ),
              );
              return;
            }
            await sleep(result.retryAfter * 1000, controller.signal);
            if (controller.signal.aborted) {
              commit((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, streaming: false, waking: undefined, stopped: true }
                    : m,
                ),
              );
              return;
            }
            continue;
          }

          commit((prev) =>
            prev.map((m) => {
              if (m.id !== assistantId) return m;
              const base = { ...m, streaming: false, waking: undefined };
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
          return;
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [commit],
  );

  const send = useCallback(
    (raw: string) => {
      // The composer already blocks typing/pasting past this via `maxLength`,
      // but `send` is also reachable directly (an example prompt, the
      // /chat?q=... auto-send) - enforce it here too so nothing can bypass it.
      const question = raw.trim().slice(0, MAX_QUESTION_CHARS);
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
