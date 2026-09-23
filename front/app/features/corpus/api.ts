import type { CorpusDocument, CorpusDocumentSummary } from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

/** Per-session cache, keyed by slug. Stores the in-flight promise so concurrent
 * opens of the same document share one request. */
const documentCache = new Map<string, Promise<CorpusDocument>>();

export function fetchDocument(slug: string): Promise<CorpusDocument> {
  let pending = documentCache.get(slug);
  if (!pending) {
    pending = requestDocument(slug).catch((err) => {
      documentCache.delete(slug); // don't cache failures - allow a retry
      throw err;
    });
    documentCache.set(slug, pending);
  }
  return pending;
}

async function requestDocument(slug: string): Promise<CorpusDocument> {
  const response = await fetch(
    `${API_URL}/rag/documents/${slug.split("/").map(encodeURIComponent).join("/")}/`,
  );
  if (!response.ok) {
    throw new Error(`Document "${slug}" failed to load (${response.status})`);
  }
  return response.json();
}

/** The whole corpus (195 rows today), unpaginated. One shared promise per
 * session - the browser page re-fetches only on an explicit retry. */
let listPending: Promise<CorpusDocumentSummary[]> | null = null;

export function fetchDocuments(): Promise<CorpusDocumentSummary[]> {
  if (!listPending) {
    listPending = requestDocuments().catch((err) => {
      listPending = null;
      throw err;
    });
  }
  return listPending;
}

async function requestDocuments(): Promise<CorpusDocumentSummary[]> {
  const response = await fetch(`${API_URL}/rag/documents/`);
  if (!response.ok) {
    throw new Error(`Corpus list failed to load (${response.status})`);
  }
  return response.json();
}
