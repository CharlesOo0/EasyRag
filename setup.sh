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

echo "Installing backend dependencies..."
"$PYTHON" -m pip install --upgrade pip
"$PYTHON" -m pip install -r requirements.txt

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
  1. Fill in real values in .env and front/.env (secrets, email creds, Google client ID).
  2. Start the backend:   .venv/Scripts/python manage.py runserver   (or .venv/bin/python on macOS/Linux)
  3. Start the frontend:  cd front && npm run dev
  4. (optional) Create an admin user: .venv/Scripts/python manage.py createsuperuser
EOF
