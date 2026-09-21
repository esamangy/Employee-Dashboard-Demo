Write-Host "Setting up Employee Dashboard..."

# Python environment
if (!(Test-Path ".venv")) {
    Write-Host "Creating Python virtual environment..."
    python -m venv .venv
}

Write-Host "Installing Python dependencies..."
& ".\.venv\Scripts\python.exe" -m pip install -r ".\requirements.txt"

# Frontend
Write-Host "Installing frontend dependencies..."

npm install

Write-Host ""
Write-Host "Setup complete!"