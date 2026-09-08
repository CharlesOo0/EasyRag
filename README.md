# EasyRag

A self-contained **RAG showcase**: a fixed corpus of documents, indexed into
pgvector, queried through a chat UI that answers with citations. Runs fully
locally — no external API keys, no login.

> Status: early development. See [`docs/ROADMAP.md`](docs/ROADMAP.md).

## What it demonstrates

- End-to-end retrieval-augmented generation: ingestion → chunking → embeddings →
  vector search → prompt assembly → grounded answer with sources.
- A local-only stack: [Ollama](https://ollama.com) for generation,
  `sentence-transformers` for embeddings, pgvector for storage.
- Streaming answers (SSE) with source snippets.
- Bilingual UI (FR/EN).

The corpus is fixed and ships with the repo (`corpus/` — 195 country profiles
from the CIA World Factbook, public domain). There is no user upload and no
account: the chat endpoint is open.

## Stack

- **RAG**: pgvector · `sentence-transformers` (`paraphrase-multilingual-MiniLM-L12-v2`, 384d) · Ollama (`llama3.2:3b`)
- **Backend**: Django 6 + Django REST Framework
- **Frontend**: React Router v8 (framework mode), TypeScript, Tailwind v4, shadcn/radix-ui
- **Infra**: Docker Compose (Postgres+pgvector, Redis, backend, frontend, Ollama)

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up --build

# once, in another terminal:
docker compose exec ollama ollama pull llama3.2:3b
docker compose exec backend python manage.py ingest_corpus
```

Starts Postgres+pgvector, Redis, the backend (`:8000`), the frontend (`:5173`)
and Ollama (`:11434`). Then open http://localhost:5173/chat.

> Auto-pulling the model and ingesting the corpus on first boot lands with the
> `docker compose up` showcase milestone.

## Quick start (local)

Prerequisites: Python 3.12, Node 20+, a Postgres with the `vector` extension
available, and [Ollama](https://ollama.com) running (`ollama pull llama3.2:3b`).

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
python manage.py createsuperuser         # for /admin/ (inspect Document / Chunk)
cd front && npm run typecheck            # react-router typegen + tsc
```

## Configuration

Backend (`.env`, see `.env.example`):

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | Required when `DEBUG=False`. |
| `DEBUG` | `True` for local dev; defaults to `False`. |
| `ALLOWED_HOSTS` | Comma-separated, required when `DEBUG=False`. |
| `DATABASE_URL` | Postgres connection string; the DB must have pgvector available. Falls back to sqlite (no vector search). |
| `REDIS_URL` | Shared cache for request throttling. Falls back to in-memory (single process only). |
| `CORS_ALLOWED_ORIGINS` | Comma-separated origins allowed to call the API. |
| `OLLAMA_URL` | Ollama base URL. Defaults to `http://localhost:11434`. |
| `RAG_LLM_MODEL` | Ollama model. Defaults to `llama3.2:3b`. |
| `RAG_EMBEDDING_MODEL` | sentence-transformers model (must be 384-dim). |
| `RAG_TOP_K`, `RAG_SIMILARITY_THRESHOLD`, `RAG_CHUNK_TOKENS`, `RAG_CHUNK_OVERLAP` | Retrieval / chunking knobs. |

Frontend (`front/.env`):

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Base URL of the backend API. |

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the RAG data flow and
[`docs/corpus-format.md`](docs/corpus-format.md) for the ingestion format.

## License

MIT — see [LICENSE](./LICENSE).
