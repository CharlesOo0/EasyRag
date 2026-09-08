export type ChatRole = "user" | "assistant";

export type ChatTurn = { role: ChatRole; content: string };

export interface ChatSource {
  title: string;
  heading_path: string;
  snippet: string;
  similarity: number;
  source_url: string;
}

/** One decoded Server-Sent Event from POST /api/rag/chat/. */
export type ChatEvent =
  | { type: "sources"; sources: ChatSource[] }
  | { type: "token"; text: string }
  | { type: "done" }
  | { type: "error"; detail: string };

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** Present on the assistant message once the `sources` event arrives. */
  sources?: ChatSource[];
  /** Set instead of (or alongside) content when the stream fails. */
  error?: string;
  /** True while the assistant message is still being streamed. */
  streaming?: boolean;
}
