#!/bin/bash

# StockTracker Pro - Development Environment Setup Script
# This script sets up and runs the complete development environment

set -e  # Exit on error

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         StockTracker Pro - Environment Setup                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored messages
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
print_status "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node --version)
print_success "Node.js $NODE_VERSION detected"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

NPM_VERSION=$(npm --version)
print_success "npm $NPM_VERSION detected"

# Create project directories if they don't exist
print_status "Creating project structure..."
mkdir -p backend
mkdir -p frontend
mkdir -p backend/src
mkdir -p backend/src/routes
mkdir -p backend/src/services
mkdir -p backend/src/middleware
mkdir -p backend/database
print_success "Project directories created"

# Check if API key exists
print_status "Checking for Finnhub API key..."
if [ -f "/tmp/api-key" ]; then
    print_success "API key found at /tmp/api-key"
else
    print_warning "API key not found at /tmp/api-key"
    print_warning "The app will attempt to use it at runtime, but features requiring market data may not work."
fi

# Backend setup
print_status "Setting up backend..."
cd backend

if [ ! -f "package.json" ]; then
    print_status "Initializing backend package.json..."
    npm init -y

    print_status "Installing backend dependencies..."
    npm install express cors better-sqlite3 bcrypt express-session dotenv
    npm install --save-dev nodemon

    print_success "Backend dependencies installed"
else
    print_status "Installing backend dependencies..."
    npm install
    print_success "Backend dependencies installed"
fi

cd ..

# Frontend setup
print_status "Setting up frontend..."
cd frontend

if [ ! -f "package.json" ]; then
    print_status "Initializing Vite React project..."
    npm create vite@latest . -- --template react

    print_status "Installing frontend dependencies..."
    npm install
    npm install react-router-dom zustand @tanstack/react-table @tanstack/react-virtual lucide-react
    npm install -D tailwindcss postcss autoprefixer

    # Initialize Tailwind CSS if not already done
    if [ ! -f "tailwind.config.js" ]; then
        print_status "Initializing Tailwind CSS..."
        npx tailwindcss init -p
    fi

    print_success "Frontend dependencies installed"
else
    print_status "Installing frontend dependencies..."
    npm install
    print_success "Frontend dependencies installed"
fi

cd ..

# Database initialization will happen automatically when backend starts
print_status "Database will be initialized automatically on backend startup"

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    Setup Complete!                             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
print_success "StockTracker Pro development environment is ready!"
echo ""
echo "To start the application:"
echo ""
echo "  ${GREEN}Backend (Terminal 1):${NC}"
echo "    cd backend"
echo "    npm run dev"
echo "    ${BLUE}→ Backend API will run on http://localhost:3001${NC}"
echo ""
echo "  ${GREEN}Frontend (Terminal 2):${NC}"
echo "    cd frontend"
echo "    npm run dev"
echo "    ${BLUE}→ Frontend will run on http://localhost:5173${NC}"
echo ""
echo "  ${GREEN}Or use the start-dev.sh script to start both:${NC}"
echo "    ./start-dev.sh"
echo ""
echo "Technology Stack:"
echo "  • Frontend: React 18 + Vite + Tailwind CSS"
echo "  • Backend: Node.js + Express"
echo "  • Database: SQLite with better-sqlite3"
echo "  • Market Data: Finnhub API"
echo "  • State: Zustand"
echo "  • Routing: React Router"
echo ""
print_warning "Note: Make sure the Finnhub API key is available at /tmp/api-key"
echo ""
