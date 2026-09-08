#!/bin/sh
# First-boot setup for `docker compose up`: migrate, pull the Ollama model, and
# ingest the corpus. Everything here is idempotent, so it also runs (fast) on
# every restart.
set -e

echo "==> Applying migrations"
python manage.py migrate --noinput

echo "==> Ensuring Ollama has the generation model (first run downloads ~2 GB)"
python - <<'PY'
import json, os, sys, urllib.request

model = os.environ.get("RAG_LLM_MODEL", "llama3.2:3b")
base = os.environ.get("OLLAMA_URL", "http://ollama:11434").rstrip("/")
req = urllib.request.Request(
    base + "/api/pull",
    data=json.dumps({"model": model}).encode(),
    headers={"Content-Type": "application/json"},
)
last = None
with urllib.request.urlopen(req, timeout=3600) as resp:
    for raw in resp:
        line = raw.decode().strip()
        if not line:
            continue
        msg = json.loads(line)
        if msg.get("error"):
            sys.exit(f"    ollama pull failed: {msg['error']}")
        status = msg.get("status")
        if status and status != last:
            print(f"    {status}")
            last = status
print(f"    model ready: {model}")
PY

echo "==> Ingesting the corpus"
python manage.py ingest_corpus

echo "==> Bootstrap complete"
