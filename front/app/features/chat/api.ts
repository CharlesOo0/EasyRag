import type { ChatEvent, ChatTurn, StreamErrorKind, StreamResult } from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

type StreamHandler = { onEvent: (event: ChatEvent) => void; signal?: AbortSignal };

/**
 * POST a question to the RAG chat endpoint. `onEvent` fires for each `sources`
 * and `token` event; the promise resolves with how the stream ended
 * (`done` / `aborted` / `incomplete` / `error`). There is no auto-retry.
 *
 * EventSource can't POST, so this reads the body stream and parses SSE by hand.
 */
export async function streamChat(
  params: { question: string; history?: ChatTurn[] },
  { onEvent, signal }: StreamHandler,
): Promise<StreamResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/rag/chat/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ question: params.question, history: params.history ?? [] }),
      signal,
    });
  } catch (err) {
    return isAbort(err) ? { status: "aborted" } : networkError(err);
  }

  if (!response.ok || !response.body) {
    return {
      status: "error",
      kind: httpErrorKind(response.status),
      detail: await readErrorDetail(response),
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawDone = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const event = parseEventBlock(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (!event) continue;
        if (event.type === "error") {
          return { status: "error", kind: "server", detail: event.detail };
        }
        if (event.type === "done") {
          sawDone = true;
        } else {
          onEvent(event);
        }
      }
    }
  } catch (err) {
    return isAbort(err) ? { status: "aborted" } : networkError(err);
  }

  return sawDone ? { status: "done" } : { status: "incomplete" };
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException
    ? err.name === "AbortError"
    : !!err && typeof err === "object" && (err as { name?: string }).name === "AbortError";
}

function networkError(err: unknown): StreamResult {
  return {
    status: "error",
    kind: "network",
    detail: err instanceof Error ? err.message : "Network error",
  };
}

function httpErrorKind(status: number): StreamErrorKind {
  if (status === 429) return "throttled";
  if (status === 400) return "bad-request";
  return "server";
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body.detail ?? body.question?.[0] ?? JSON.stringify(body);
  } catch {
    return `Request failed (${response.status})`;
  }
}

function parseEventBlock(block: string): ChatEvent | null {
  let name = "";
  let data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) name = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!name) return null;

  let payload: any = {};
  try {
    payload = data ? JSON.parse(data) : {};
  } catch {
    return null;
  }

  switch (name) {
    case "sources":
      return { type: "sources", sources: Array.isArray(payload) ? payload : [] };
    case "token":
      return { type: "token", text: String(payload.text ?? "") };
    case "done":
      return { type: "done" };
    case "error":
      return { type: "error", detail: String(payload.detail ?? "Unknown error") };
    default:
      return null;
  }
}
