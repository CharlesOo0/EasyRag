import type { CorpusDocument } from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

/** Per-session cache, keyed by slug. Stores the in-flight promise so concurrent
 * opens of the same document share one request. */
const cache = new Map<string, Promise<CorpusDocument>>();

export function fetchDocument(slug: string): Promise<CorpusDocument> {
  let pending = cache.get(slug);
  if (!pending) {
    pending = request(slug).catch((err) => {
      cache.delete(slug); // don't cache failures - allow a retry
      throw err;
    });
    cache.set(slug, pending);
  }
  return pending;
}

async function request(slug: string): Promise<CorpusDocument> {
  const response = await fetch(
    `${API_URL}/rag/documents/${slug.split("/").map(encodeURIComponent).join("/")}/`,
  );
  if (!response.ok) {
    throw new Error(`Document "${slug}" failed to load (${response.status})`);
  }
  return response.json();
}
