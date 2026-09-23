/** One entry in `GET /api/rag/documents/` - enough to list and filter. */
export interface CorpusDocumentSummary {
  slug: string;
  title: string;
  metadata: Record<string, unknown>;
}

/** A full corpus document from `GET /api/rag/documents/<slug>/`. */
export interface CorpusDocument extends CorpusDocumentSummary {
  body: string;
}
