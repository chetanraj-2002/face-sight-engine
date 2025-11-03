#!/bin/bash

# Run Face Recognition API Docker container
echo "Starting Face Recognition API container..."

docker run -d \
  --name face-recognition-api \
  -p 5000:5000 \
  -v $(pwd)/dataset:/app/dataset \
  -v $(pwd)/output:/app/output \
  -v $(pwd)/attendance:/app/attendance \
  -v $(pwd)/dataset_backup:/app/dataset_backup \
  -v "$(pwd)/Image Data:/app/Image Data" \
  --restart unless-stopped \
  face-recognition-api:latest

if [ $? -eq 0 ]; then
    echo "✅ Container started successfully!"
    echo ""
    echo "API is running at: http://localhost:5000"
    echo ""
    echo "Useful commands:"
    echo "  View logs:    docker logs -f face-recognition-api"
    echo "  Stop:         docker stop face-recognition-api"
    echo "  Remove:       docker rm face-recognition-api"
    echo "  Restart:      docker restart face-recognition-api"
else
    echo "❌ Failed to start container!"
    exit 1
fi
