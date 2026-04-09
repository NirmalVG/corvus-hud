"""
CORVUS YOLO detection API — serves Ultralytics YOLO for the HUD client.

Environment (optional):
  YOLO_MODEL     — weights file or Ultralytics hub id (default: yolov8n.pt)
  YOLO_CONF      — min confidence 0–1 (default: 0.30)
  YOLO_IOU       — NMS IoU (default: 0.45)
  YOLO_IMGSZ     — inference size (default: 640)
  YOLO_MAX_DET   — max boxes per frame (default: 25)
  CORS_ORIGINS   — comma-separated origins, or * (default: *)
  MAX_IMAGE_BYTES — max upload size (default: 10485760 = 10 MiB)
"""

from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager
from typing import Any

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from ultralytics import YOLO

# ─── Config ───────────────────────────────────────────────────────────────────

YOLO_MODEL = os.environ.get("YOLO_MODEL", "yolov8n.pt").strip()
YOLO_CONF_DEFAULT = float(os.environ.get("YOLO_CONF", "0.30"))
YOLO_IOU_DEFAULT = float(os.environ.get("YOLO_IOU", "0.45"))
YOLO_IMGSZ_DEFAULT = int(os.environ.get("YOLO_IMGSZ", "640"))
YOLO_MAX_DET_DEFAULT = int(os.environ.get("YOLO_MAX_DET", "25"))
MAX_IMAGE_BYTES = int(os.environ.get("MAX_IMAGE_BYTES", str(10 * 1024 * 1024)))

_cors_raw = os.environ.get("CORS_ORIGINS", "*").strip()
CORS_ORIGINS: list[str] = (
    [o.strip() for o in _cors_raw.split(",") if o.strip()]
    if _cors_raw and _cors_raw != "*"
    else ["*"]
)

model: YOLO | None = None
model_load_error: str | None = None
model_load_ms: float | None = None


# Ultralytics COCO-80 names -> keys used in lib/objectTracker.ts (COCO-SSD style)
YOLO_TO_TRACKER_CLASS: dict[str, str] = {
    "tv": "tvmonitor",
    "cell phone": "cell_phone",
    "dining table": "diningtable",
}


def _tracker_class_name(raw_name: str) -> str:
    """Align YOLO class strings with the HUD object tracker / COCO-SSD naming."""
    key = raw_name.strip().lower().replace("-", " ")
    if key in YOLO_TO_TRACKER_CLASS:
        return YOLO_TO_TRACKER_CLASS[key]
    # Most COCO classes: remove spaces ("wine glass" -> "wineglass"); tracker keys match.
    return key.replace(" ", "")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, model_load_error, model_load_ms
    model_load_error = None
    t0 = time.perf_counter()
    try:
        print(f"[CORVUS] Loading YOLO: {YOLO_MODEL} ...")
        model = YOLO(YOLO_MODEL)
        model_load_ms = (time.perf_counter() - t0) * 1000
        print(f"[CORVUS] YOLO ready in {model_load_ms:.0f} ms")
    except Exception as e:
        model_load_error = str(e)
        model = None
        print(f"[CORVUS] YOLO load failed: {model_load_error}")
    yield
    model = None


app = FastAPI(
    title="CORVUS Detection Backend",
    version="1.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict[str, Any]:
    return {
        "service": "corvus-yolo",
        "version": "1.1.0",
        "docs": "/docs",
        "health": "/health",
        "detect": "POST /detect",
    }


@app.get("/health")
def health() -> JSONResponse:
    out: dict[str, Any] = {
        "status": "online" if model is not None else "degraded",
        "model": YOLO_MODEL,
        "ready": model is not None,
        "load_time_ms": round(model_load_ms, 1) if model_load_ms is not None else None,
    }
    if model_load_error:
        out["error"] = model_load_error
    if model is not None:
        try:
            dev = str(getattr(model, "device", "cpu"))
        except Exception:
            dev = "unknown"
        out["device"] = dev
    status_code = 200 if model is not None else 503
    return JSONResponse(content=out, status_code=status_code)


@app.post("/detect")
async def detect(
    file: UploadFile = File(...),
    conf: float = Query(
        default=YOLO_CONF_DEFAULT,
        ge=0.05,
        le=0.99,
        description="Minimum confidence",
    ),
    iou: float = Query(
        default=YOLO_IOU_DEFAULT,
        ge=0.1,
        le=0.95,
        description="NMS IoU threshold",
    ),
    imgsz: int = Query(
        default=YOLO_IMGSZ_DEFAULT,
        ge=320,
        le=1280,
        description="Inference image size (square)",
    ),
    max_det: int = Query(
        default=YOLO_MAX_DET_DEFAULT,
        ge=1,
        le=100,
        description="Maximum detections per frame",
    ),
) -> dict[str, Any]:
    if model is None:
        raise HTTPException(
            status_code=503,
            detail=model_load_error or "Model not ready",
        )

    ctype = (file.content_type or "").lower()
    if ctype and not (
        ctype.startswith("image/")
        or ctype in ("application/octet-stream", "binary/octet-stream")
    ):
        raise HTTPException(
            status_code=400,
            detail="Content-Type must be an image or application/octet-stream",
        )

    contents = await file.read()
    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image too large (max {MAX_IMAGE_BYTES} bytes)",
        )
    if len(contents) < 32:
        raise HTTPException(status_code=400, detail="Empty or invalid image")

    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Could not decode image bytes")

    h, w = frame.shape[:2]
    if w < 8 or h < 8:
        raise HTTPException(status_code=400, detail="Image dimensions too small")

    t_infer0 = time.perf_counter()
    results = model.predict(
        frame,
        conf=conf,
        iou=iou,
        max_det=max_det,
        imgsz=imgsz,
        verbose=False,
    )
    infer_ms = (time.perf_counter() - t_infer0) * 1000

    detections: list[dict[str, Any]] = []

    for result in results:
        if result.boxes is None:
            continue
        names = result.names or {}
        for box in result.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            cls_id = int(box.cls[0])
            raw_name = names.get(cls_id, str(cls_id))
            label = _tracker_class_name(str(raw_name))

            x1 = max(0, round(x1))
            y1 = max(0, round(y1))
            x2 = min(w, round(x2))
            y2 = min(h, round(y2))
            bw = max(0, x2 - x1)
            bh = max(0, y2 - y1)
            if bw < 1 or bh < 1:
                continue

            detections.append(
                {
                    "class": label,
                    "confidence": round(float(box.conf[0]), 4),
                    "bbox": [x1, y1, bw, bh],
                    "source": "yolo",
                }
            )

    return {
        "detections": detections,
        "count": len(detections),
        "model": YOLO_MODEL,
        "frame_size": {"width": w, "height": h},
        "inference_ms": round(infer_ms, 2),
        "params": {
            "conf": conf,
            "iou": iou,
            "imgsz": imgsz,
            "max_det": max_det,
        },
    }
