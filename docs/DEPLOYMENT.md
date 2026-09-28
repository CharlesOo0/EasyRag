# Deployment

EasyRag is a demo, not a product — this is the path that's actually live
(`easyrag.dev`), not a hypothetical one. Full narrative (blockers hit, bugs
found, decisions and why) is in `docs/azure-deployment-plan.md` - this file
is the clean reference for reproducing it, not the story of how we got here.

## The four pieces

| Piece | What | Why |
|---|---|---|
| **App VM** | one Azure VM (`Standard_D2ps_v6`, ARM64, Spot), `docker compose` running Postgres+pgvector, Ollama, the Django backend, and the frontend, all behind Caddy on one port | Ollama needs a long-lived host with real RAM - not a fit for scale-to-zero serverless, and a VM + compose is the most direct path from what's already tested locally |
| **Guardian** | a small FastAPI reverse proxy (`guardian/`), deployed as an always-on Azure Container App | The VM is expensive to leave running 24/7 for a low-traffic showcase - the guardian wakes it on the first request, sleeps it after ~12 min idle, and is the actual public entry point (custom domain + TLS live here, not on the VM) |
| **Database** | PostgreSQL with the `vector` extension, in the same `docker compose` stack on the VM | no managed service - see "why one VM" above; `pgvector/pgvector` image |
| **LLM** | Ollama, same VM, same compose stack | co-located with the app for simplicity; see "Not using Ollama?" below if that changes |

## The real path — Azure VM + guardian

1. **VM**: `Standard_D2ps_v6` (2 vCPU/8 GB, ARM64), Spot pricing, no NSG rule
   open except SSH (restricted to a known IP) and the Caddy port (8080,
   restricted to the guardian's outbound IP range - see "Known limitation"
   below). ARM64 was a deliberate choice: cheaper, and everything in this
   repo (backend Dockerfile, `pgvector/pgvector`, PyTorch CPU wheels,
   Ollama) has an arm64 build - verified, not assumed.

2. **App stack on the VM**: `docker-compose.yml` (dev) +
   `docker-compose.prod.yml` (override - real env, no insecure defaults,
   `restart: unless-stopped` on every long-running service). Real env comes
   from a `.env.prod` file on the host, never committed - see
   `.env.prod.example`. Bring it up with:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
   ```

   The prod override also swaps the frontend's dev server for a real SSR
   build (`front/Dockerfile`'s `production` stage, `VITE_API_URL=/api`
   baked in as a build arg - same-origin, correct through the guardian
   regardless of domain) and adds `caddy`, which is the one thing dev
   doesn't need at all: it's what lets the guardian talk to a single origin
   for both the frontend and `/api/*`, on port 8080. See `Caddyfile`.

   **`restart: unless-stopped` is not optional.** The guardian's whole
   point is deallocating and restarting this VM - `dockerd` only
   auto-starts a container on daemon boot per its own restart policy,
   independent of `depends_on`. Without it, every wake comes back with the
   VM up and nothing running behind it (confirmed the hard way, see
   `docs/azure-deployment-plan.md`).

3. **Guardian**: deployed once as a persistent Azure Container App (not
   redeployed per VM cycle) - `guardian/README.md` has the deployment
   constraints (exactly 1 replica, managed identity, required RBAC roles,
   **explicit health probes on `/internal/healthz` are mandatory** or
   Container Apps' own default probe traffic wakes the VM with zero real
   traffic). Points at the VM via `GUARDIAN_VM_ORIGIN=http://<vm-ip>:8080`.

4. **TLS + domain**: terminated at the guardian, **not** Caddy. A custom
   domain bound to the Container App gets a free Azure-managed certificate
   (no Let's Encrypt, no cert management on the VM at all) - see "TLS"
   below for the DNS records this actually needs. Caddy on the VM only
   ever sees plain HTTP from the guardian and hardcodes
   `X-Forwarded-Proto: https` for that reason (see `Caddyfile`'s comment -
   correct specifically because nothing but the guardian can reach that
   port).

5. **Database**: first boot ingests the corpus via the `bootstrap` service
   (~10 min - migrate, pull the Ollama model, `ingest_corpus`). A faster
   path that skips the wait entirely: `pg_dump` an already-ingested local
   Postgres and restore it on the VM before starting `bootstrap` -
   `ingest_corpus` is idempotent (content-hashed), so `bootstrap` just
   confirms `0 created, 0 updated, N unchanged` instead of re-embedding
   everything. Used for every deploy and test so far.

**Known limitation, accepted deliberately**: the guardian → VM leg (Caddy's
port 8080) is restricted by NSG to the outbound IP range of the shared
Container Apps environment it runs in, not a single IP dedicated to this
one app - anything else in that environment could in principle reach it.
Accepted because the app itself is public with no auth anyway (see below);
revisit with VNet integration if that ever stops being true.

### Sizing (measured, not estimated)

A real load test (`docs/azure-deployment-plan.md`, 27-28/09) on this exact
VM size found RAM is not the constraint (~4.5/7.7 GB under 4 concurrent
chats) - CPU is: 2 of 4 truly simultaneous generations blew past the 120s
Ollama read timeout. `RAG_MAX_CONCURRENT_CHATS` is set to `2` to match.

## TLS

Managed certificate on the Container App's custom domain, not Caddy/Let's
Encrypt. Needs **three** DNS records at the domain registrar (found the
hard way - the first two are enough for domain *ownership*, a third,
separate one is needed for the *certificate* specifically, with its own
token printed by the bind command):

| Type | Host | Value |
|---|---|---|
| CNAME | `@` (or the subdomain) | the Container App's default FQDN |
| TXT | `asuid` | the domain-ownership token from `az containerapp hostname add` |
| TXT | `_dnsauth` | the certificate-validation token from `az containerapp hostname bind` |

```bash
az containerapp hostname add --hostname <domain> --name <app> --resource-group <rg>
# add the asuid TXT record it prints, wait for DNS propagation, then:
az containerapp hostname bind --hostname <domain> --name <app> --resource-group <rg> \
  --environment <environment-resource-id> --validation-method TXT
# add the _dnsauth TXT record it prints, wait for propagation, then re-run
# the same bind command - it can take Azure up to ~20 min to issue the cert
```

Don't delete and recreate the managed certificate if a bind attempt fails
while waiting on DNS propagation - each new certificate resource gets a
**different** `_dnsauth` token, so deleting just resets the wait instead of
fixing anything. Just re-run `hostname bind` once the record is confirmed
propagated (`nslookup -type=TXT`, a public resolver like `8.8.8.8` to avoid
local caching).

## Public API — no login, so the limits matter

The chat endpoint has no auth in front of it by design. Three things bound how
much damage one client (or one bad actor) can do:

- **`RAG_CHAT_THROTTLE`** (default `10/min`) / **`RAG_READ_THROTTLE`**
  (`120/min`) — per-IP request rate, via DRF's `ScopedRateThrottle`.
- **`RAG_MAX_CONCURRENT_CHATS`** (default `2` - see "Sizing" above) — caps
  how many answers can be generating at once; past that the server returns
  `503` immediately instead of queueing the connection silently. This is a
  **per-process** limit (a plain `threading.Semaphore`), which is why the
  image ships with `gunicorn --workers 1` — running more workers would give
  each its own counter instead of one shared cap.
- **`RAG_MAX_TOKENS`** (default `600`) — passed to Ollama as `num_predict`, so
  one answer can't run generation out to the model's own limit and tie up a
  worker for the full `OLLAMA_READ_TIMEOUT`.
- **`RAG_MAX_HISTORY_CHARS`** (default `4000`) — the client-supplied `history`
  field is shaped by the serializer (10 turns, 500 chars each) but that still
  allows ~5,000 chars of prefill the model has to chew through before it can
  answer; this trims it to the most recent turns that fit, the same idea as
  `RAG_PROMPT_CONTEXT_CHARS` applied to retrieved passages.

**`TRUSTED_PROXY_COUNT`** (`1` in prod, see `docker-compose.prod.yml`)
governs whether the per-IP throttle trusts `X-Forwarded-For` at all. Left
at its dev default (`0`), the throttle keys on the raw connecting socket
and ignores the header entirely — safe by default: a client can set
`X-Forwarded-For` to anything it likes, and most proxies (Caddy included,
by default) *append* to an existing value rather than replace it, so
trusting it unconditionally lets a client bypass the whole limit by
varying its own prefix on every request. `1` here reflects the one real
hop (Caddy) between the guardian and the backend - DRF then reads the
client IP as the last entry of `X-Forwarded-For`. Only raise it further if
there is a *second* proxy hop also under your control.

Before exposing this publicly, also run:

```bash
python manage.py check --deploy   # Django's own production checklist
pip-audit                          # backend dependencies
cd front && npm audit              # frontend dependencies
```

## Environment variables

| Variable | Prod value |
|---|---|
| `SECRET_KEY` | required (no dev fallback when `DEBUG=False`) |
| `DEBUG` | `False` |
| `ALLOWED_HOSTS` | your domain(s), comma-separated |
| `DATABASE_URL` | Postgres + pgvector connection string |
| `REDIS_URL` | not set - the app runs a single gunicorn worker by design, so `LocMemCache` does the same job; only relevant for a hypothetical >1-worker setup |
| `CORS_ALLOWED_ORIGINS` | the frontend origin(s) |
| `CSRF_TRUSTED_ORIGINS` | the frontend/admin origin(s) |
| `USE_X_FORWARDED_PROTO` | `True` — required behind Caddy or the HTTPS redirect loops |
| `OLLAMA_URL` | the Ollama server |
| `RAG_LLM_MODEL` | model to pull / use (default `llama3.2:3b`) |
| `RAG_MAX_TOKENS` | cap on one answer's length (default `600`) |
| `RAG_MAX_CONCURRENT_CHATS` | cap on simultaneous generations (default `2` — measured, see "Sizing") |
| `RAG_MAX_HISTORY_CHARS` | cap on client-supplied conversation history fed to the prompt (default `4000`) |
| `RAG_CHAT_THROTTLE` / `RAG_READ_THROTTLE` | per-IP request rate (default `10/min` / `120/min`) |
| `TRUSTED_PROXY_COUNT` | `1` in prod (one Caddy hop) — see above |

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

Built and served by `docker-compose.prod.yml` (see above) - `front/Dockerfile`'s
`production` stage runs `react-router-serve` (SSR) on `:3000`, behind Caddy.
`VITE_API_URL=/api` is baked in at build time as a Docker build arg (the
Dockerfile fails the build if it's unset - Vite bakes `import.meta.env.VITE_*`
into the static bundle, so a runtime env var is too late for this stage).

Deploying the frontend some other way (no Caddy in front)? Either run the
same SSR build standalone (`VITE_API_URL=https://your-domain/api npm run
build && npm run start`), or serve `front/build/client` statically and
proxy `/api` to the backend from the same origin (`VITE_API_URL=/api`
still works, same reasoning).

## Not using Ollama?

`apps/rag/services/llm.py` speaks Ollama's `/api/chat` (newline-delimited JSON,
`keep_alive`). To use a different backend (an OpenAI-compatible endpoint, say),
replace `stream_chat` — it's ~40 lines, one function, and the only Ollama-aware
code. Everything upstream (`retrieval`, `prompt`) and the SSE view are unchanged.

## Not using a wake/sleep guardian?

Everything above except the guardian itself and the TLS section still
applies to a plain always-on VM - put any TLS-terminating reverse proxy
(Caddy, nginx, Traefik) directly in front of Caddy's port instead of a
Container App, and get a cert for it the normal way (e.g. Let's Encrypt).
The rest (compose files, env vars, throttle reasoning, sizing) is
unchanged.
