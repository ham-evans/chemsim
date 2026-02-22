#!/bin/bash
set -e

PROJ_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Starting ChemSim Development Servers ==="

# Start backend
echo "Starting backend on :8000..."
PYTHONPATH="$PROJ_DIR/engine/build:$PROJ_DIR/backend" \
    uvicorn chemsim_api.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Start frontend
echo "Starting frontend on :3000..."
cd "$PROJ_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Backend:  http://localhost:8000 (PID: $BACKEND_PID)"
echo "Frontend: http://localhost:3000 (PID: $FRONTEND_PID)"
echo ""
echo "Press Ctrl+C to stop both servers"

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
