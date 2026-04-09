# Build from repository root (Railway default context):
#   docker build -f backend/Dockerfile .
#
# Local from backend/ only:
#   docker build -f Dockerfile .
#   (then temporarily use COPY lines without the backend/ prefix)

# --- Stage 1: Build Environment ---
FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- Stage 2: Final Runtime Image ---
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

ENV YOLO_MODEL=yolov8n.pt
RUN python -c "from ultralytics import YOLO; import os; YOLO(os.environ.get('YOLO_MODEL','yolov8n.pt'))"

COPY backend /app/backend

ENV PORT=7860
EXPOSE 7860
CMD sh -c "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}"
