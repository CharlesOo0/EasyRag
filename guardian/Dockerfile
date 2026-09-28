FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8080

# --workers 1 is not a performance choice - the in-process lock and cached
# power state in app/main.py are only a valid single source of truth with
# exactly one worker process. See the module docstring in app/main.py.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
