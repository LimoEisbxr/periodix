#!/bin/bash
set -e

# Docker Build Script for Periodix
# This script provides workarounds for common Docker build issues on Ubuntu,
# particularly the "failed to execute bake: read |0: file already closed" error

echo "🐳 Periodix Docker Build Script"
echo "==============================="

# Load environment variables
if [ -f .env ]; then
    source .env
fi

# Set default values
DOCKER_BUILDKIT=${DOCKER_BUILDKIT:-1}
COMPOSE_DOCKER_CLI_BUILD=${COMPOSE_DOCKER_CLI_BUILD:-1}

echo "Docker BuildKit: $DOCKER_BUILDKIT"
echo "Compose Docker CLI Build: $COMPOSE_DOCKER_CLI_BUILD"

# Function to attempt build with BuildKit
build_with_buildkit() {
    echo "🚀 Attempting build with Docker BuildKit..."
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1
    
    if docker compose up -d --build "$@"; then
        echo "✅ Build successful with BuildKit!"
        return 0
    else
        echo "❌ Build failed with BuildKit"
        return 1
    fi
}

# Function to attempt build without BuildKit (fallback)
build_without_buildkit() {
    echo "🔄 Attempting build without Docker BuildKit (fallback)..."
    export DOCKER_BUILDKIT=0
    export COMPOSE_DOCKER_CLI_BUILD=0
    
    if docker compose up -d --build "$@"; then
        echo "✅ Build successful without BuildKit!"
        return 0
    else
        echo "❌ Build failed without BuildKit"
        return 1
    fi
}

# Function to attempt legacy docker build
build_legacy() {
    echo "🔄 Attempting legacy docker build..."
    export DOCKER_BUILDKIT=0
    
    echo "Building backend..."
    if ! docker build -t periodix-backend ./periodix-backend; then
        echo "❌ Backend build failed"
        return 1
    fi
    
    echo "Building frontend..."
    if ! docker build -t periodix-frontend ./periodix-frontend; then
        echo "❌ Frontend build failed"
        return 1
    fi
    
    echo "Starting services..."
    if docker compose up -d "$@"; then
        echo "✅ Legacy build successful!"
        return 0
    else
        echo "❌ Legacy build failed"
        return 1
    fi
}

# Main build logic
echo "Starting build process..."

# Try BuildKit first if enabled
if [ "$DOCKER_BUILDKIT" = "1" ]; then
    if build_with_buildkit "$@"; then
        exit 0
    fi
    
    echo ""
    echo "⚠️  BuildKit failed. This is a known issue on some Ubuntu systems."
    echo "   Trying fallback without BuildKit..."
    echo ""
fi

# Try without BuildKit
if build_without_buildkit "$@"; then
    exit 0
fi

echo ""
echo "⚠️  Standard docker-compose build failed. Trying legacy approach..."
echo ""

# Try legacy build as last resort
if build_legacy "$@"; then
    exit 0
fi

echo ""
echo "❌ All build methods failed!"
echo ""
echo "Troubleshooting tips:"
echo "1. Make sure Docker Desktop is running"
echo "2. Try: 'docker system prune -a' to clean up Docker cache"
echo "3. Set DOCKER_BUILDKIT=0 in your .env file permanently"
echo "4. Check if you have enough disk space and memory"
echo "5. Try building individual services: 'docker compose build frontend' or 'docker compose build backend'"
echo ""
exit 1