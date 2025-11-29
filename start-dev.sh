#!/bin/bash

# StockTracker Pro - Start Development Servers
# Starts both backend and frontend servers simultaneously

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║       StockTracker Pro - Starting Development Servers         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if backend and frontend directories exist
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo -e "${BLUE}[INFO]${NC} Project not fully set up. Running init.sh first..."
    ./init.sh
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

echo -e "${GREEN}[BACKEND]${NC} Starting backend server on port 3001..."
cd backend
npm run dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

echo -e "${GREEN}[FRONTEND]${NC} Starting frontend server on port 5173..."
cd frontend
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                   Servers Started!                             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}Backend API:${NC}  http://localhost:3001"
echo -e "${GREEN}Frontend App:${NC} http://localhost:5173"
echo ""
echo "Logs are being written to:"
echo "  • logs/backend.log"
echo "  • logs/frontend.log"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
