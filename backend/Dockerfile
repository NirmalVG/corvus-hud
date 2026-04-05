# --- Stage 1: Build Environment ---
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# 1. Install CPU-ONLY TORCH (Essential to stay under 4GB)
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

# 2. Install your requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- Stage 2: Final Runtime Image ---
FROM python:3.11-slim

WORKDIR /app

# Install the EXACT libraries OpenCV needs to avoid libGL.so.1 error
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy only the installed python libraries from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Pre-load the YOLOv8n weights
# This will now work because libgl1 is installed above
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

# Copy your code
COPY main.py .

EXPOSE 7860
CMD uvicorn main:app --host 0.0.0.0 --port 7860