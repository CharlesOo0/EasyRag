# Auth Template

A full-stack authentication starter: Django REST backend + React Router (v8) frontend.
Meant to be **forked and adapted** for new projects rather than used as-is.

## Features

- Email/password auth with mandatory email verification via a 6-digit OTP code
- JWT auth delivered as HttpOnly cookies (not exposed to JS), with CSRF protection and automatic refresh-and-retry on 401
- Google OAuth login (PKCE)
- Custom user model with role flags (`is_customer`, `is_administrator`) and matching DRF permission classes
- Password complexity validation
- Rate limiting on login, registration, and OTP verify/resend
- i18n (French/English) kept in sync between backend and frontend
- Docker Compose setup (Postgres + backend + frontend)

## Stack

- **Backend**: Django 6 + Django REST Framework, `dj-rest-auth` + `django-allauth`, `djangorestframework-simplejwt`
- **Frontend**: React Router v8 (framework mode, SSR-capable), TypeScript, Tailwind v4, shadcn/radix-ui

## Getting started

### Backend

```bash
cp .env.example .env   # then fill in SECRET_KEY, EMAIL_* etc.
python -m venv .venv
.venv\Scripts\activate       # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver   # http://localhost:8000
```

Other useful commands:

```bash
python manage.py test                                          # full test suite
python manage.py test apps.authentication.tests.SomeTestCase.test_x # single test
python manage.py createsuperuser
```

#### Scheduled maintenance jobs (production)

Neither of these runs automatically - wire them into your platform's scheduler (cron, a Kubernetes CronJob, Heroku Scheduler, etc.) once deployed:

| Command | Purpose | Suggested schedule |
|---|---|---|
| `python manage.py purge_unverified_users --older-than-hours=24` | Deletes accounts that never completed OTP e-mail verification. | Daily |
| `python manage.py flushexpiredtokens` | Deletes expired rows from `simplejwt`'s outstanding/blacklisted refresh-token tables, which otherwise grow unbounded (see `ROTATE_REFRESH_TOKENS`/`BLACKLIST_AFTER_ROTATION` in `core/settings.py`). | Daily |

### Frontend

```bash
cd front
cp .env.example .env   # set VITE_API_URL, VITE_GOOGLE_CLIENT_ID
npm install
npm run dev        # http://localhost:5173
npm run typecheck   # react-router typegen + tsc
npm run build       # production build
```

### Docker (full stack)

```bash
docker-compose up --build
```

Runs Postgres, backend (`:8000`) and frontend (`:5173`). The compose file hardcodes
dev-only env vars (`DEBUG=True`, an insecure `SECRET_KEY`) — do not use it as-is in production.

## Environment variables

Backend (`.env`, see `.env.example`):

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | Django secret key. Required when `DEBUG=False`. |
| `JWT_SIGNING_KEY` | Signing key for JWT access/refresh tokens, kept separate from `SECRET_KEY` so leaking/rotating one doesn't force rotating the other. Required when `DEBUG=False`. |
| `DEBUG` | Defaults to `False`. Only set `True` locally. |
| `ALLOWED_HOSTS` | Comma-separated hosts, required in production. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated origins allowed to call the API. |
| `CSRF_TRUSTED_ORIGINS` | Comma-separated origins trusted for CSRF-protected requests. Defaults to `FRONTEND_URL`; set explicitly if the frontend is served from more than one origin. |
| `USE_X_FORWARDED_PROTO` | Set to `True` only if deployed behind a reverse proxy/load balancer that terminates TLS and sets `X-Forwarded-Proto` (and strips any client-supplied copy of that header). Needed so `SECURE_SSL_REDIRECT` doesn't redirect-loop. |
| `FRONTEND_URL` | Used to build email-confirmation/password-reset redirect links, and as the default `CSRF_TRUSTED_ORIGINS`. |
| `DATABASE_URL` | Falls back to local sqlite if unset. |
| `REDIS_URL` | Cache backend, shared by OTP codes and DRF rate-limiting. **Required in any multi-worker/multi-container deployment** - without it, each process gets its own in-memory cache, so OTP verification and throttling both misbehave. Falls back to a local in-memory cache if unset (fine for a single `runserver` process only). |
| `EMAIL_*` | SMTP settings used to send OTP/verification emails. |

Frontend (`front/.env`, see `front/.env.example`):

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Base URL of the backend API. |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID for the login button. |

## Adapting this template for a new project

When forking this repo for a new project, check these spots:

- Rename the Django project (`core/`) and update `DJANGO_SETTINGS_MODULE` references if you want a project-specific name instead of `core`.
- Replace `LANGUAGE_CODE`/`LANGUAGES` in `core/settings.py` and the `front/app/locales/*.json` files with the locales your project actually needs.
- Review `apps/authentication/models.py` role flags (`is_customer`, `is_administrator`) — extend or replace them to match your project's actual roles.
- Set a real `SECRET_KEY`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, and SMTP credentials per environment — never reuse the `.env.example` placeholders.
- Point `VITE_GOOGLE_CLIENT_ID` (and the corresponding Google Cloud OAuth client) at your own project, or remove the Google login button/view if not needed.

See `CLAUDE.md` for a deeper architectural walkthrough (auth flow details, file responsibilities, gotchas).

## License

MIT — see [LICENSE](./LICENSE).
