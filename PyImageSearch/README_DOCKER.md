# Docker Setup Guide

## Prerequisites

- Docker installed (https://docs.docker.com/get-docker/)
- Docker Compose installed (usually comes with Docker Desktop)

## Quick Start

### Option 1: Using Docker Compose (Recommended)

```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

### Option 2: Using Build Scripts

```bash
# Make scripts executable (Linux/Mac)
chmod +x build.sh run.sh

# Build the image
./build.sh

# Run the container
./run.sh
```

### Option 3: Manual Docker Commands

```bash
# Build the image
docker build -t face-recognition-api:latest .

# Run the container
docker run -d \
  --name face-recognition-api \
  -p 5000:5000 \
  -v $(pwd)/dataset:/app/dataset \
  -v $(pwd)/output:/app/output \
  -v $(pwd)/attendance:/app/attendance \
  face-recognition-api:latest
```

## Configuration

### Environment Variables

Edit `.env` file:
```
FLASK_ENV=production
FLASK_DEBUG=False
```

### Port Configuration

By default, the API runs on port 5000. To change:

**docker-compose.yml:**
```yaml
ports:
  - "8080:5000"  # External:Internal
```

**Or in run.sh:**
```bash
-p 8080:5000
```

## Deployment to AWS ECS

### 1. Build and Push to ECR

```bash
# Authenticate Docker to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Build for production
docker build -t face-recognition-api:latest .

# Tag for ECR
docker tag face-recognition-api:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/face-recognition-api:latest

# Push to ECR
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/face-recognition-api:latest
```

### 2. Create ECS Task Definition

Create `ecs-task-definition.json`:
```json
{
  "family": "face-recognition-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [
    {
      "name": "face-recognition-api",
      "image": "YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/face-recognition-api:latest",
      "portMappings": [
        {
          "containerPort": 5000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "FLASK_ENV",
          "value": "production"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/face-recognition-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### 3. Deploy to ECS

```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name face-recognition-cluster

# Register task definition
aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json

# Create ECS service
aws ecs create-service \
  --cluster face-recognition-cluster \
  --service-name face-recognition-service \
  --task-definition face-recognition-api \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

## Useful Commands

### Docker Container Management

```bash
# View running containers
docker ps

# View all containers
docker ps -a

# View logs
docker logs -f face-recognition-api

# Execute command in container
docker exec -it face-recognition-api bash

# Stop container
docker stop face-recognition-api

# Start container
docker start face-recognition-api

# Remove container
docker rm face-recognition-api

# View container resource usage
docker stats face-recognition-api
```

### Docker Image Management

```bash
# List images
docker images

# Remove image
docker rmi face-recognition-api:latest

# Prune unused images
docker image prune -a
```

### Debugging

```bash
# Check container health
docker inspect face-recognition-api | grep -A 10 Health

# View detailed logs
docker logs --tail 100 face-recognition-api

# Check container environment
docker exec face-recognition-api env
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker logs face-recognition-api

# Check if port is already in use
lsof -i :5000

# Verify image built correctly
docker images | grep face-recognition-api
```

### Permission issues with volumes

```bash
# Fix volume permissions
chmod -R 755 dataset output attendance
```

### Out of memory

Increase memory in docker-compose.yml:
```yaml
deploy:
  resources:
    limits:
      memory: 4G
```

## Production Checklist

- [ ] Set `FLASK_ENV=production` in `.env`
- [ ] Set `FLASK_DEBUG=False` in `.env`
- [ ] Configure proper logging
- [ ] Set up health check monitoring
- [ ] Configure auto-restart policy
- [ ] Set resource limits (CPU/Memory)
- [ ] Enable CORS for your frontend domain only
- [ ] Set up HTTPS with reverse proxy (nginx/traefik)
- [ ] Configure backup strategy for `output/` folder
- [ ] Set up monitoring and alerts
