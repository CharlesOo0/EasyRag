FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# Where sentence-transformers / huggingface_hub cache the embedding model.
# docker-compose mounts a named volume here so it isn't re-downloaded (~470 MB)
# every time the container is recreated.
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

COPY . /app/

RUN useradd --create-home --shell /bin/bash appuser \
    && mkdir -p /opt/hf-cache \
    && chown -R appuser:appuser /app /opt/hf-cache \
    && chmod +x /app/entrypoint.sh

EXPOSE 8000

# Runs as root so it can apply migrations/collectstatic against volumes
# (e.g. a fresh named volume for staticfiles) before dropping to appuser
# to actually run the server. See entrypoint.sh.
ENTRYPOINT ["/app/entrypoint.sh"]
# gthread workers + a long timeout: the /api/rag/chat SSE response stays open
# for the whole (CPU-slow) LLM generation, which the default sync worker with
# its 30s timeout kills mid-stream.
CMD ["gunicorn", "core.wsgi:application", "--bind", "0.0.0.0:8000", "--worker-class", "gthread", "--workers", "2", "--threads", "8", "--timeout", "300"]
