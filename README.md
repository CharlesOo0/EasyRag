# EasyRag

A self-contained **RAG showcase**: a fixed corpus of documents, indexed into
pgvector, queried through a chat UI that answers with citations. Runs fully
locally — no external API keys — on top of a Django + React Router stack.

> Status: early development. See [`docs/ROADMAP.md`](docs/ROADMAP.md).

## What it demonstrates

- End-to-end retrieval-augmented generation: ingestion → chunking → embeddings →
  vector search → prompt assembly → grounded answer with sources.
- A local-only stack: [Ollama](https://ollama.com) for generation,
  `sentence-transformers` for embeddings, pgvector for storage.
- Streaming answers (SSE) with clickable source snippets.
- Bilingual UI (FR/EN).

The corpus is fixed and ships with the repo (`corpus/`) — there is no user upload.

## Stack

- **RAG**: pgvector · `sentence-transformers` (`paraphrase-multilingual-MiniLM-L12-v2`, 384d) · Ollama (`llama3.1`)
- **Backend**: Django 6 + Django REST Framework
- **Frontend**: React Router v8 (framework mode), TypeScript, Tailwind v4, shadcn/radix-ui
- **Infra**: Docker Compose (Postgres+pgvector, Redis, backend, frontend, Ollama)

An email/password + Google OAuth auth layer is included (from the starter template)
but the RAG chat itself is public.

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up --build

# once, in another terminal: pull the generation model into the ollama container
docker compose exec ollama ollama pull llama3.1
```

This starts Postgres+pgvector, Redis, the backend (`:8000`), the frontend
(`:5173`) and Ollama (`:11434`). Then open http://localhost:5173.

> Auto-pulling the model and ingesting the corpus on first boot lands with the
> `docker compose up` showcase milestone; for now run the `pull` above and
> `docker compose exec backend python manage.py ingest_corpus` yourself.

## Quick start (local)

Prerequisites: Python 3.12, Node 20+, a Postgres with the `vector` extension
available, and [Ollama](https://ollama.com) running (`ollama pull llama3.1`).

### Backend

```bash
cp .env.example .env            # set DATABASE_URL, OLLAMA_URL if not default
python -m venv .venv
.venv\Scripts\activate          # Windows  (source .venv/bin/activate on Unix)
pip install -r requirements.txt   # includes torch; on Linux add
                                  #   --extra-index-url https://download.pytorch.org/whl/cpu
python manage.py migrate
python manage.py ingest_corpus  # index corpus/ into pgvector
python manage.py runserver      # http://localhost:8000
```

### Frontend

```bash
cd front
cp .env.example .env            # set VITE_API_URL
npm install
npm run dev                     # http://localhost:5173
```

## Useful commands

```bash
python manage.py ingest_corpus --reset   # wipe and re-index the corpus
python manage.py test                    # backend test suite
cd front && npm run typecheck            # react-router typegen + tsc
```

## Configuration

Backend (`.env`, see `.env.example`):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. Must point at a DB with pgvector available. Falls back to sqlite (no vector search). |
| `OLLAMA_URL` | Ollama base URL. Defaults to `http://localhost:11434`. |
| `RAG_LLM_MODEL` | Ollama model name. Defaults to `llama3.1`. |
| `RAG_EMBEDDING_MODEL` | sentence-transformers model. Defaults to `paraphrase-multilingual-MiniLM-L12-v2`. |
| `RAG_TOP_K` | Number of chunks retrieved per query. Defaults to `5`. |
| `SECRET_KEY`, `JWT_SIGNING_KEY` | Required when `DEBUG=False`. |
| `REDIS_URL` | Shared cache (OTP codes + rate limiting). Required for multi-worker deployments. |
| `EMAIL_*` | SMTP settings for the auth layer's verification emails. |

Frontend (`front/.env`):

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Base URL of the backend API. |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID (auth layer only). |

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the RAG data flow, and
`CLAUDE.md` (local) for working notes.

## License

MIT — see [LICENSE](./LICENSE).
