export type ChatRole = "user" | "assistant";

export type ChatTurn = { role: ChatRole; content: string };

export interface ChatSource {
  /** URL-facing id of the source document (`GET /api/rag/documents/<slug>/`). */
  slug: string;
  title: string;
  heading_path: string;
  snippet: string;
  similarity: number;
  source_url: string;
}

/** A full corpus document from `GET /api/rag/documents/<slug>/`. */
export interface CorpusDocument {
  slug: string;
  title: string;
  metadata: Record<string, unknown>;
  body: string;
}

/** A decoded Server-Sent Event from POST /api/rag/chat/. `sources` and `token`
 * are streamed to the caller; `done` / `error` become the stream's result. */
export type ChatEvent =
  | { type: "sources"; sources: ChatSource[] }
  | { type: "token"; text: string }
  | { type: "done" }
  | { type: "error"; detail: string };

export type StreamErrorKind = "network" | "throttled" | "server" | "bad-request";

/** How a stream ended. */
export type StreamResult =
  | { status: "done" }
  | { status: "aborted" }
  | { status: "incomplete" } // connection closed before the `done` event
  | { status: "error"; kind: StreamErrorKind; detail: string };

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** Present on the assistant message once the `sources` event arrives. */
  sources?: ChatSource[];
  /** Set when the stream failed. */
  error?: { kind: StreamErrorKind; detail: string };
  /** The user pressed Stop. */
  stopped?: boolean;
  /** The connection dropped mid-answer. */
  incomplete?: boolean;
  /** True while the assistant message is still streaming. */
  streaming?: boolean;
}
