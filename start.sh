#!/bin/bash

# Start frontend (in the background)
npm run dev &
FRONTEND_PID=$!
cd backend
# Start celery (in the background)
celery -A worker worker -Q priority, standard &
CELERY_PID=$!
# Start backend (in foreground)
flask run --host=0.0.0.0
BACKEND_PID=$!
cd ..

# Wait for all to finish (so Ctrl+C kills all)
wait $FRONTEND_PID $CELERY_PID $BACKEND_PID
