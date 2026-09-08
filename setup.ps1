# First-time local (non-Docker) setup for this template: venv, backend deps,
# .env files, migrations, and frontend deps. Safe to re-run.
$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

$venvDir = ".venv"

if (-not (Test-Path $venvDir)) {
    Write-Host "Creating virtualenv in $venvDir..."
    python -m venv $venvDir
}

$python = Join-Path $venvDir "Scripts\python.exe"

Write-Host "Installing backend dependencies..."
& $python -m pip install --upgrade pip
& $python -m pip install -r requirements.txt

if (-not (Test-Path ".env")) {
    Write-Host "Creating .env from .env.example (fill in real secrets before running)."
    Copy-Item ".env.example" ".env"
} else {
    Write-Host ".env already exists, leaving it untouched."
}

if (-not (Test-Path "front\.env")) {
    Write-Host "Creating front\.env from front\.env.example."
    Copy-Item "front\.env.example" "front\.env"
} else {
    Write-Host "front\.env already exists, leaving it untouched."
}

Write-Host "Applying database migrations..."
& $python manage.py migrate

if (Test-Path "front") {
    Write-Host "Installing frontend dependencies..."
    Push-Location front
    npm install
    Pop-Location
}

Write-Host ""
Write-Host "Setup complete."
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Fill in real values in .env and front\.env (SECRET_KEY, DATABASE_URL)."
Write-Host "  2. Ingest the corpus:   .venv\Scripts\python manage.py ingest_corpus"
Write-Host "  3. Start the backend:   .venv\Scripts\python manage.py runserver"
Write-Host "  4. Start the frontend:  cd front; npm run dev"
Write-Host "  5. (optional) Admin user for /admin/: .venv\Scripts\python manage.py createsuperuser"
