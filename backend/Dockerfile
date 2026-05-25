FROM python:3.10-slim

# Install system packages required for OpenCV and YOLOv8
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /code

# Copy requirements and install CPU-optimized PyTorch first to speed up builds and stay inside free tier storage limits
COPY ./requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r /code/requirements.txt

# Copy application code and trained models
COPY . /code

# Expose standard Hugging Face port 7860
EXPOSE 7860

# Run uvicorn server on port 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
