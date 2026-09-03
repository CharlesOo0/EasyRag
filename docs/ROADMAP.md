# Roadmap

Work is tracked in GitHub Issues, grouped by milestone. Labels: `type:*`
(`feat`/`bug`/`chore`/`docs`/`test`), `area:*` (`rag`/`backend`/`frontend`/`infra`/`docs`),
`prio:*` (`high`/`med`/`low`).

## v0.1 — Fondations

Get the RAG plumbing in place. No end-user feature yet.

- Scaffold the `apps/rag` Django app (`Document`, `Chunk` models with a pgvector `VectorField`).
- Migration enabling the `vector` extension.
- Embedding service: `sentence-transformers`, multilingual MiniLM (384d), lazy load, batching.
- Ollama client: chat + streaming, timeouts, error handling.
- RAG settings block (`OLLAMA_URL`, `RAG_LLM_MODEL`, `RAG_EMBEDDING_MODEL`, `RAG_TOP_K`).
- `docker-compose`: switch Postgres to the `pgvector/pgvector` image; add an Ollama service.

## v0.2 — Ingestion

- Fixed demo corpus: ~12 markdown docs for a fictional product, under `corpus/`.
- Chunking: split on headings + token window with overlap.
- `manage.py ingest_corpus` — idempotent (content hash), `--reset` flag, re-index changed docs only.
- Tests for chunking + ingestion (embeddings mocked).

## v0.3 — Retrieval & API

- Vector search service: `CosineDistance`, top-k, similarity threshold.
- Prompt assembly: numbered context blocks + citation instructions.
- `POST /api/rag/chat` — public, throttled, SSE streaming; returns tokens + a source list.
- Conversation history (session + messages) — optional.
- Tests for the endpoint (retrieval + LLM mocked).

## v0.4 — Frontend chat

- `/chat` route: message list + input.
- Streaming answer rendering (SSE).
- Source cards: snippet + link to the document.
- FR/EN i18n for all chat strings.
- Empty state with example questions.

## v1.0 — Showcase

- EasyRag landing page explaining the RAG pipeline, linking to the demo.
- `docker compose up` brings everything up, corpus auto-ingested.
- `docs/ARCHITECTURE.md` with a data-flow diagram.
- CI updated for the RAG deps and tests.
- Deployment notes (prod Dockerfile, hosting).
