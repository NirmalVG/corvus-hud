from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import numpy as np
import cv2
import os

app = FastAPI(title="CORVUS Detection Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # lock to your domain after testing
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Load once at startup — not per request
model = None

@app.on_event("startup")
async def load_model():
    global model
    print("[CORVUS] Loading YOLOv8n...")
    model = YOLO("yolov8n.pt")
    print("[CORVUS] YOLOv8n ready ✅")

@app.get("/health")
def health():
    return {
        "status": "online",
        "model": "yolov8n",
        "ready": model is not None,
    }

@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not ready")

    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Read and decode image
    contents = await file.read()
    nparr    = np.frombuffer(contents, np.uint8)
    frame    = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if frame is None:
        raise HTTPException(status_code=400, detail="Could not decode image")

    # Run YOLOv8 inference
    results = model.predict(
        frame,
        conf=0.30,       # confidence threshold — lower than COCO-SSD
        iou=0.45,        # NMS IoU threshold
        max_det=15,      # max detections per frame
        imgsz=640,       # input size
        verbose=False,   # suppress logs
    )

    detections = []
    h, w = frame.shape[:2]

    for result in results:
        for box in result.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()

            # Clamp to frame bounds
            x1 = max(0, round(x1))
            y1 = max(0, round(y1))
            x2 = min(w, round(x2))
            y2 = min(h, round(y2))

            detections.append({
                "class":      result.names[int(box.cls[0])],
                "confidence": round(float(box.conf[0]), 3),
                "bbox":       [x1, y1, x2 - x1, y2 - y1],  # [x,y,w,h]
                "source":     "yolo",
            })

    return {
        "detections": detections,
        "count":      len(detections),
        "model":      "yolov8n",
        "frame_size": {"width": w, "height": h},
    }