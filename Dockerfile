FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# Where sentence-transformers / huggingface_hub cache the embedding model. The
# model is downloaded into the image below; docker-compose also mounts a named
# volume here (seeded from the image) so it survives container recreation.
ENV HF_HOME=/opt/hf-cache

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    gosu \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/
# CPU-only PyTorch. A stock container has no GPU access (that needs
# nvidia-container-toolkit + an explicit device reservation) and the deploy
# target is CPU anyway, so the default CUDA wheels (~2 GB) would be dead weight.
RUN pip install --no-cache-dir -r requirements.txt \
    --extra-index-url https://download.pytorch.org/whl/cpu

# Bake the embedding model into the image so `docker compose up` needs no
# network and the first request pays no download. Keep the name in sync with
# RAG_EMBEDDING_MODEL (core/settings.py).
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')"

# Model is present now, so never hit the HF Hub at runtime - the freshness check
# alone adds ~20s to the first load.
ENV HF_HUB_OFFLINE=1
ENV TRANSFORMERS_OFFLINE=1

COPY . /app/

RUN useradd --create-home --shell /bin/bash appuser \
    && chown -R appuser:appuser /app /opt/hf-cache \
    && chmod +x /app/entrypoint.sh

EXPOSE 8000

# Runs as root so it can apply migrations/collectstatic against volumes
# (e.g. a fresh named volume for staticfiles) before dropping to appuser
# to actually run the server. See entrypoint.sh.
ENTRYPOINT ["/app/entrypoint.sh"]
# --preload: core/wsgi loads the embedding model once in the master, forked
#   workers inherit it (copy-on-write) so no request waits ~15s for it.
# gthread + a long timeout: the /api/rag/chat SSE response is held open for the
#   whole (CPU-slow) generation; the default sync worker's 30s timeout kills it.
CMD ["gunicorn", "core.wsgi:application", "--bind", "0.0.0.0:8000", "--preload", "--worker-class", "gthread", "--workers", "1", "--threads", "8", "--timeout", "300"]
