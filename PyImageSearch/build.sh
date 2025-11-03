#!/bin/bash

# Build Docker image for Face Recognition API
echo "Building Face Recognition API Docker image..."

docker build -t face-recognition-api:latest .

if [ $? -eq 0 ]; then
    echo "✅ Docker image built successfully!"
    echo ""
    echo "To run the container, use:"
    echo "  ./run.sh"
    echo ""
    echo "Or use docker-compose:"
    echo "  docker-compose up -d"
else
    echo "❌ Docker build failed!"
    exit 1
fi
