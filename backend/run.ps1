# Start Alcoma.ai FastAPI Backend Server
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "      Alcoma.ai Marine Intelligence API      " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Verify Python environment
Write-Host "🔍 Verifying environment..." -ForegroundColor Yellow
python -c "import fastapi, uvicorn, ultralytics; print('✅ Dependencies verified successfully.')"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Missing dependencies. Installing requirements..." -ForegroundColor Red
    pip install -r requirements.txt
}

Write-Host "🚀 Launching FastAPI server..." -ForegroundColor Green
python main.py
