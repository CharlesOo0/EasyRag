"""
WSGI config for core project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/wsgi/
"""

import logging
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

application = get_wsgi_application()


# Warm the embedding model now (import time) rather than on the first chat
# request - loading sentence-transformers is ~15s of imports + model construction.
# With gunicorn --preload this runs once in the master and forked workers inherit
# the loaded model via copy-on-write. Failure here must not stop the server
# (e.g. a dev box where the ML deps aren't importable).
if os.environ.get('RAG_PRELOAD_EMBEDDINGS', '1') == '1':
    try:
        from apps.rag.services.embeddings import _get_model

        _get_model()
    except Exception:  # pragma: no cover
        logging.getLogger('apps.rag').warning('Embedding model preload failed', exc_info=True)
