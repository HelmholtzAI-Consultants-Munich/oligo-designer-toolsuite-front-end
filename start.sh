#!/bin/bash

# Start frontend (in the background)
npm run dev &
FRONTEND_PID=$!
# Start celery (in the background)
celery -A backend.worker worker &
CELERY_PID=$!
# Start backend (in foreground)
flask --app backend/app run --host=0.0.0.0 --port=8000
BACKEND_PID=$!
cd ..

# Wait for all to finish (so Ctrl+C kills all)
wait $FRONTEND_PID $CELERY_PID $BACKEND_PID
