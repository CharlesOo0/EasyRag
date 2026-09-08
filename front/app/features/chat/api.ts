import type { ChatEvent, ChatTurn } from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

/**
 * POST a question to the RAG chat endpoint and invoke `onEvent` for each
 * Server-Sent Event (`sources`, then `token` x N, then `done` - or a terminal
 * `error`). Resolves when the stream ends. A non-2xx response (validation,
 * throttle) is delivered as a single `error` event.
 *
 * EventSource can't POST, so this reads the body stream and parses SSE by hand.
 */
export async function streamChat(
  params: { question: string; history?: ChatTurn[] },
  { onEvent, signal }: { onEvent: (event: ChatEvent) => void; signal?: AbortSignal },
): Promise<void> {
  const response = await fetch(`${API_URL}/rag/chat/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ question: params.question, history: params.history ?? [] }),
    signal,
  });

  if (!response.ok || !response.body) {
    onEvent({ type: "error", detail: await readErrorDetail(response) });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const event = parseEventBlock(block);
      if (event) onEvent(event);
    }
  }
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
