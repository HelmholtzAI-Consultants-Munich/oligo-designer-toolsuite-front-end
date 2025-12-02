#!/bin/bash

# Start frontend (in the background)
npm run dev &
FRONTEND_PID=$!
cd flask
# Start celery (in the background)
celery -A worker worker &
CELERY_PID=$!
# Start backend (in foreground)
python app.py
BACKEND_PID=$!
cd ..

# Wait for all to finish (so Ctrl+C kills all)
wait $FRONTEND_PID $CELERY_PID $BACKEND_PID
