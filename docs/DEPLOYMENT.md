# Deployment

EasyRag is a demo, not a product — this is what a realistic deploy looks like,
not a hardened runbook.

## The three pieces

| Piece | What | Options |
|---|---|---|
| **App** | this repo's image (Django + gunicorn) | any container host |
| **Database** | PostgreSQL **with the `vector` extension** | managed (Neon, Supabase, Crunchy Bridge, RDS + `pgvector`) or self-hosted (`pgvector/pgvector` image) |
| **LLM** | an Ollama server | same box, a separate machine, or a GPU instance |

The frontend is a small React Router app — build it and serve it (SSR via
`react-router-serve`, or the static `build/client` behind the same proxy as the API).

## Simplest path — one VPS, docker compose

The dev `docker-compose.yml` is already close. For production:

1. Set real env on the `backend` **and** `bootstrap` services (they share the
   `x-backend-env` anchor):

   ```yaml
   DEBUG: "False"
   SECRET_KEY: <a real 50-char secret>
   ALLOWED_HOSTS: easyrag.example.com
   CORS_ALLOWED_ORIGINS: https://easyrag.example.com
   CSRF_TRUSTED_ORIGINS: https://easyrag.example.com
   USE_X_FORWARDED_PROTO: "True"   # if behind a TLS-terminating proxy
   ```

   With `DEBUG=False` the security hardening in `settings.py` turns on: HSTS,
   secure cookies, HTTP→HTTPS redirect. `USE_X_FORWARDED_PROTO=True` is required
   behind a proxy or the redirect loops.

2. Put a TLS proxy (Caddy, nginx, Traefik) in front of the frontend. **Disable
   response buffering** for `/api/rag/chat/` — SSE must stream (nginx:
   `proxy_buffering off;`). The view already sends `X-Accel-Buffering: no`.

3. `docker compose up -d` — the `bootstrap` service pulls the model and ingests
   the corpus on first boot (~10 min), then the app comes up.

Sizing: Ollama with `llama3.2:3b` needs ~4 GB RAM; the backend ~1 GB (the
embedding model is loaded at start). CPU generation is ~10 s per answer — fine
for a low-traffic showcase, not for load.

## Managed services path

- **Database** — create a Postgres with pgvector (Neon and Supabase enable the
  extension for you; on RDS run `CREATE EXTENSION vector;` once). Set
  `DATABASE_URL=postgres://…`.
- **Redis** — only needed for correct request throttling across >1 worker. Set
  `REDIS_URL`, or drop it and run a single worker.
- **App** — build and push the image:

  ```bash
  docker build -t <registry>/easyrag:latest .
  ```

  Run `gunicorn` (it's the image `CMD`). One release/one-off command per deploy:

  ```bash
  python manage.py migrate
  python manage.py ingest_corpus        # idempotent; ~5-10 min the first time
  ```

- **LLM** — point `OLLAMA_URL` at an Ollama server. It won't fit in a typical
  small app dyno; run it on a dedicated machine (a cheap GPU box makes answers
  near-instant) or a container platform that allows a long-lived 4 GB process.

### Not using Ollama?

`apps/rag/services/llm.py` speaks Ollama's `/api/chat` (newline-delimited JSON,
`keep_alive`). To use a different backend (an OpenAI-compatible endpoint, say),
replace `stream_chat` — it's ~40 lines, one function, and the only Ollama-aware
code. Everything upstream (`retrieval`, `prompt`) and the SSE view are unchanged.

## Environment variables

| Variable | Prod value |
|---|---|
| `SECRET_KEY` | required (no dev fallback when `DEBUG=False`) |
| `DEBUG` | `False` |
| `ALLOWED_HOSTS` | your host(s), comma-separated |
| `DATABASE_URL` | Postgres + pgvector connection string |
| `REDIS_URL` | for multi-worker throttling; optional otherwise |
| `CORS_ALLOWED_ORIGINS` | the frontend origin(s) |
| `CSRF_TRUSTED_ORIGINS` | the admin origin(s), if the admin is served elsewhere |
| `USE_X_FORWARDED_PROTO` | `True` behind a TLS proxy |
| `OLLAMA_URL` | the Ollama server |
| `RAG_LLM_MODEL` | model to pull / use (default `llama3.2:3b`) |

The `RAG_*` retrieval knobs (see [ARCHITECTURE.md](ARCHITECTURE.md)) rarely need
changing in prod.

## Image size

~4 GB — the CPU PyTorch stack (torch + transformers + scikit-learn + scipy) plus
the ~470 MB embedding model baked in. Acceptable for a showcase. To trim:

- multi-stage build: compile wheels in a builder stage, copy only site-packages
  into a slim runtime stage, drop `gcc` / `libpq-dev` build deps;
- or don't bake the model — mount a volume for `HF_HOME` and let the first run
  download it (drop `HF_HUB_OFFLINE`).

## Frontend

```bash
cd front
npm ci
VITE_API_URL=https://easyrag.example.com/api npm run build
npm run start        # react-router-serve, SSR, on :3000
```

`VITE_API_URL` is baked at build time. Or serve `front/build/client` statically
and proxy `/api` to the backend from the same origin (then `VITE_API_URL=/api`).
