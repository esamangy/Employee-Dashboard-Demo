#!/bin/bash

echo "Setting up Employee Dashboard..."

# Python environment

if [ ! -d ".venv" ]; then
echo "Creating Python virtual environment..."
python3 -m venv .venv
fi

echo "Installing Python dependencies..."
./.venv/bin/python -m pip install -r "./requirements.txt"

# Frontend

echo "Installing frontend dependencies..."

npm install

echo ""
echo "Setup complete!"
