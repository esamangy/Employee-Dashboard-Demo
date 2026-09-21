#!/bin/bash

# Start Flask

(
source .venv/bin/activate
python ./app.py
) &

# Start Vite

npm run dev
