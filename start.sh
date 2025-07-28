#!/bin/bash

# Start frontend (in the background)
npm start &
FRONTEND_PID=$!
# Start backend (in foreground)
cd flask
python app.py
BACKEND_PID=$!
cd ..

# Wait for both to finish (so Ctrl+C kills both)
wait $FRONTEND_PID $BACKEND_PID