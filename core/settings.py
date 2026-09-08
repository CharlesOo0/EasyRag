"""
Django settings for the EasyRag project.

EasyRag is a public, no-login app: the only endpoint is the RAG chat, which is
open. `django.contrib.auth` + the admin are kept so `createsuperuser` works for
inspecting the corpus (`Document` / `Chunk`).
"""

import os
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


# SECURITY WARNING: don't run with debug turned on in production!
# Defaults to False (secure by default) - dev environments must opt in via .env.
DEBUG = os.getenv("DEBUG", "False") == "True"

# SECURITY WARNING: keep the secret key secret. Only DEBUG tolerates a missing
# one (insecure dev fallback); production must provide it or fail to start.
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = "django-insecure-default-key"
    else:
        raise ImproperlyConfigured("SECRET_KEY must be set when DEBUG=False.")

ALLOWED_HOSTS = [h for h in os.getenv("ALLOWED_HOSTS", "").split(",") if h]


# Application definition

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party
    "rest_framework",
    "corsheaders",
    # Local
    "apps.rag",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "core.urls"
WSGI_APPLICATION = "core.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


# Database - falls back to local sqlite (no vector search) if DATABASE_URL is unset.

DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
    )
}


# Cache - shared across workers/containers when REDIS_URL is set; DRF request
# throttling relies on it. Falls back to a per-process LocMemCache (fine for a
# single `runserver`).

REDIS_URL = os.getenv("REDIS_URL")
if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": REDIS_URL,
            "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
        }
    }
else:
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# Internationalization

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
LANGUAGES = [("fr", "French"), ("en", "English")]


# Static files

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# REST framework - the RAG chat is the only endpoint and it is public.

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework.authentication.SessionAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.AllowAny",),
    "DEFAULT_THROTTLE_CLASSES": ("rest_framework.throttling.ScopedRateThrottle",),
    "DEFAULT_THROTTLE_RATES": {
        # Public RAG chat endpoint (apps/rag/views.py).
        "rag_chat": "20/min",
    },
}


# CORS - the SPA is served from a different origin than the API.

CORS_ALLOWED_ORIGINS = os.getenv(
    "CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")

# Trusted for CSRF-protected requests (the admin, mainly). Set when the admin is
# served from a different host than Django sees (behind a proxy).
CSRF_TRUSTED_ORIGINS = [
    o for o in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",") if o
]


# Security hardening (HTTPS / cookies) - only bites in production (DEBUG=False).

SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_SSL_REDIRECT = not DEBUG
SECURE_HSTS_SECONDS = 31536000 if not DEBUG else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG

# A real deployment usually terminates TLS at a proxy, so Django only sees plain
# HTTP. Trust X-Forwarded-Proto only when opted in (the proxy must strip any
# client-supplied copy), or SECURE_SSL_REDIRECT redirect-loops.
if os.getenv("USE_X_FORWARDED_PROTO", "False") == "True":
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")


# RAG Configuration
# All local by default: a local Ollama server for generation and a local
# sentence-transformers model for embeddings. No external API keys.
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
RAG_LLM_MODEL = os.getenv("RAG_LLM_MODEL", "llama3.2:3b")
# Ollama HTTP timeouts (seconds): connect is quick; read is the gap between
# streamed tokens and must tolerate slow CPU inference / a cold model load.
OLLAMA_CONNECT_TIMEOUT = float(os.getenv("OLLAMA_CONNECT_TIMEOUT", 5))
OLLAMA_READ_TIMEOUT = float(os.getenv("OLLAMA_READ_TIMEOUT", 120))
# Must be a 384-dim model - the value is baked into rag.Chunk.embedding
# (apps/rag/models.py EMBEDDING_DIMENSIONS).
RAG_EMBEDDING_MODEL = os.getenv(
    "RAG_EMBEDDING_MODEL", "paraphrase-multilingual-MiniLM-L12-v2"
)
# How many chunks to retrieve per question.
RAG_TOP_K = int(os.getenv("RAG_TOP_K", 5))
# Chunking: target window and overlap, in (approximate) tokens. The default
# model's context window is 128 tokens, so keep RAG_CHUNK_TOKENS well under it.
RAG_CHUNK_TOKENS = int(os.getenv("RAG_CHUNK_TOKENS", 110))
RAG_CHUNK_OVERLAP = int(os.getenv("RAG_CHUNK_OVERLAP", 20))
# Minimum cosine similarity (1 - cosine distance; 1 = identical, -1 = opposite)
# for a retrieved chunk to be kept. Below this it's dropped before the prompt is
# built. Deliberately loose - the corpus is short factual text and the prompt is
# told to ignore weak context.
RAG_SIMILARITY_THRESHOLD = float(os.getenv("RAG_SIMILARITY_THRESHOLD", 0.4))
