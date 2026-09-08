#!/bin/sh
# First-time local (non-Docker) setup for this template: venv, backend deps,
# .env files, migrations, and frontend deps. Safe to re-run.
set -e

cd "$(dirname "$0")"

VENV_DIR=".venv"

if [ ! -d "$VENV_DIR" ]; then
  echo "Creating virtualenv in $VENV_DIR..."
  python -m venv "$VENV_DIR"
fi

if [ -f "$VENV_DIR/Scripts/python.exe" ]; then
  PYTHON="$VENV_DIR/Scripts/python.exe"
else
  PYTHON="$VENV_DIR/bin/python"
fi

echo "Installing backend dependencies (incl. torch, CPU wheels)..."
"$PYTHON" -m pip install --upgrade pip
"$PYTHON" -m pip install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu

if [ ! -f ".env" ]; then
  echo "Creating .env from .env.example (fill in real secrets before running)."
  cp .env.example .env
else
  echo ".env already exists, leaving it untouched."
fi

if [ ! -f "front/.env" ]; then
  echo "Creating front/.env from front/.env.example."
  cp front/.env.example front/.env
else
  echo "front/.env already exists, leaving it untouched."
fi

echo "Applying database migrations..."
"$PYTHON" manage.py migrate

if [ -d "front" ]; then
  echo "Installing frontend dependencies..."
  (cd front && npm install)
fi

cat <<'EOF'

Setup complete.

Next steps:
  1. Fill in real values in .env and front/.env (SECRET_KEY, DATABASE_URL).
  2. Ingest the corpus:   .venv/bin/python manage.py ingest_corpus
  3. Start the backend:   .venv/bin/python manage.py runserver   (.venv/Scripts/python on Windows)
  4. Start the frontend:  cd front && npm run dev
  5. (optional) Admin user for /admin/: .venv/bin/python manage.py createsuperuser
EOF
