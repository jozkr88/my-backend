FROM python:3.12-slim

WORKDIR /app

COPY services/causal_service/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY services /app/services

ENV PYTHONUNBUFFERED=1
CMD ["sh", "-c", "uvicorn causal_service.app:app --app-dir /app/services --host 0.0.0.0 --port ${PORT:-8010}"]

