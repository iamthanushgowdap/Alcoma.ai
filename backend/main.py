import os
import uuid
import torch
import anyio
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

# Initialize FastAPI App
app = FastAPI(
    title="Alcoma.ai Marine Plastic Detection API",
    description="FastAPI backend serving custom YOLOv8 model for real-time marine plastic pollution detection.",
    version="1.0.0"
)

# Enable CORS for Next.js frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model configuration
MODEL_PATH = r"C:\Users\choco\OneDrive\Documents\marine\src\trainedmodels\marin-plastic\best.pt"

# Create a temporary directory within the workspace for file processing
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMP_DIR = os.path.join(BASE_DIR, "temp")
os.makedirs(TEMP_DIR, exist_ok=True)

# Select computation device (prefer GPU / CUDA for RTX 2050 4GB)
device = "cuda" if torch.cuda.is_available() else "cpu"
print("Using trained weights from:")
print(f"  {MODEL_PATH}")
print(f"🚀 SYSTEM DIAGNOSTIC: Loading custom YOLOv8 model from {MODEL_PATH}")
print(f"⚙️ COMPUTATION DEVICE: Utilizing '{device}'")

# Load YOLO model
try:
    model = YOLO(MODEL_PATH)
    model.to(device)
    print("Loaded custom model: best.pt")
    print("✅ Model loaded successfully.")
    
    # GPU Warmup for RTX 2050 4GB (eliminates first-request compile delay)
    if device == "cuda":
        import numpy as np
        print("⚡ Warming up CUDA kernels...")
        dummy_img = np.zeros((640, 640, 3), dtype=np.uint8)
        # Run dummy prediction to warm up GPU
        model.predict(source=dummy_img, device=device, half=True, verbose=False)
        print("🔥 CUDA warmup complete. YOLOv8 pipeline is hot and ready.")
except Exception as e:
    print(f"❌ ERROR: Failed to load YOLOv8 model weights: {e}")
    raise RuntimeError(f"Could not load YOLO model at {MODEL_PATH}. Reason: {e}")

def run_inference(image_path: str):
    """
    Executes YOLOv8 object detection on the saved image.
    Uses FP16 half-precision on CUDA devices to optimize RTX 2050 4GB VRAM usage.
    """
    use_half = (device == "cuda")
    
    # Run prediction with a strict NMS IoU threshold (0.35) to remove duplicates
    results = model.predict(
        source=image_path,
        device=device,
        half=use_half,
        conf=0.15,
        iou=0.35,
        verbose=False
    )
    
    predictions = []
    for result in results:
        boxes = result.boxes
        for box in boxes:
            # Extract coordinates (absolute pixel coordinates)
            xyxy = box.xyxy[0].tolist()  # [x1, y1, x2, y2]
            
            # Ignore tiny noisy boxes (below 12x12 pixels)
            width = xyxy[2] - xyxy[0]
            height = xyxy[3] - xyxy[1]
            if width < 12 or height < 12:
                continue
                
            confidence = float(box.conf[0].item())
            class_id = int(box.cls[0].item())
            label = model.names[class_id]
            
            predictions.append({
                "x1": xyxy[0],
                "y1": xyxy[1],
                "x2": xyxy[2],
                "y2": xyxy[3],
                "label": label,
                "confidence": confidence
            })
            
    return predictions

@app.get("/health")
def health_check():
    """Simple API health check endpoint."""
    return {
        "status": "online",
        "model": "best.pt",
        "device": device,
        "model_loaded": model is not None,
        "cuda_available": torch.cuda.is_available()
    }

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    """
    Accepts uploaded image file, processes inference, 
    and returns bounding box coordinates.
    """
    # Verify file type is an image
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file is not an image.")
        
    # Generate unique filename for temporary file
    file_ext = os.path.splitext(file.filename)[1]
    temp_file_name = f"{uuid.uuid4()}{file_ext}"
    temp_file_path = os.path.join(TEMP_DIR, temp_file_name)
    
    try:
        # Asynchronously read file contents and save to local workspace temp directory
        content = await file.read()
        with open(temp_file_path, "wb") as buffer:
            buffer.write(content)
            
        import time
        start_time = time.time()
        # Execute inference in worker thread pool to prevent blocking the event loop
        predictions = await anyio.to_thread.run_sync(run_inference, temp_file_path)
        inference_time_ms = round((time.time() - start_time) * 1000, 1)
        
        return {
            "predictions": predictions,
            "model_used": "best.pt",
            "model_path": MODEL_PATH,
            "inference_time_ms": inference_time_ms
        }
        
    except Exception as e:
        print(f"❌ INFERENCE ERROR: {e}")
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")
        
    finally:
        # Always clean up temporary image file
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception as e:
                print(f"⚠️ TEMP CLEANUP WARNING: Could not delete {temp_file_path}: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
