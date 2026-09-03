# Contributing

## Workflow

1. Pick an issue (or open one). Issues are grouped by milestone — see [`docs/ROADMAP.md`](docs/ROADMAP.md).
2. Branch from `master`: `type/short-slug` (`feat/`, `fix/`, `chore/`, `docs/`, `test/`).
3. Commit in small, focused steps. Imperative mood, English, e.g. `add pgvector migration`.
4. Open a PR against `master`. Reference the issue (`Closes #12`). CI must be green.

## Local setup

See [`README.md`](README.md) for backend / frontend / Docker setup.

## Checks before pushing

```bash
python manage.py test           # backend
cd front && npm run typecheck   # frontend types
cd front && npm run build       # frontend build
```

CI runs the same three on every push and PR.

## Conventions

- **Backend**: Django apps live under `apps/`. Keep views thin; put RAG logic in
  `apps/rag/services/`. RAG tests must mock the embedding model and Ollama — no
  network, no model download in CI.
- **Frontend**: React Router v8 framework mode. Shared UI in `front/app/components/ui`,
  feature code in `front/app/features/<feature>`. All user-facing strings go through
  i18n (`front/app/locales/{en,fr}.json`).
- **Migrations**: commit them with the model change that produced them.
- No AI-attribution trailers or notices in commits, PRs, code, or docs.
