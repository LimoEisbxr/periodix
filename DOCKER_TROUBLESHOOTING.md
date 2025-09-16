# Docker Build Troubleshooting Guide

This document provides solutions for common Docker build issues encountered with Periodix, particularly on Ubuntu systems.

## The "failed to execute bake" Error

### Error Message
```
#39 [frontend] resolving provenance for metadata file 
failed to execute bake: read |0: file already closed
```

### Root Cause
This error occurs due to issues with Docker BuildKit on certain Ubuntu systems, particularly when:
- There are resource constraints (memory/disk)
- Docker BuildKit has communication issues with the Docker daemon
- The build context is too large or contains problematic files
- There are network connectivity issues during the build process

### Solutions (in order of preference)

#### 1. Use the Enhanced Build Script (Recommended)
```bash
./docker-build.sh
```
This script automatically tries multiple build strategies and provides detailed error reporting.

#### 2. Disable BuildKit Temporarily
```bash
DOCKER_BUILDKIT=0 docker compose up -d --build
```

#### 3. Set BuildKit to Disabled Permanently
Add to your `.env` file:
```bash
DOCKER_BUILDKIT=0
COMPOSE_DOCKER_CLI_BUILD=0
```

#### 4. Use the Legacy Docker Compose File
```bash
docker compose -f docker-compose.legacy.yml up -d --build
```

#### 5. Build Services Individually
```bash
docker compose build db
docker compose build backend  
docker compose build frontend
docker compose up -d
```

#### 6. Clean Docker System and Retry
```bash
docker system prune -a
docker volume prune
docker compose up -d --build
```

## Other Build Issues

### Out of Memory Errors
If builds fail due to memory constraints:
```bash
# Increase Docker Desktop memory limit to 4GB+ in settings
# Or build one service at a time:
docker compose build backend
docker compose build frontend
```

### Network Issues
If npm install fails during build:
```bash
# Check Docker DNS settings
docker run --rm alpine nslookup registry.npmjs.org

# Try building with different DNS:
docker compose build --build-arg DOCKER_BUILDKIT=0
```

### Permission Issues
On Linux systems, ensure proper permissions:
```bash
sudo chown -R $USER:$USER .
chmod +x docker-build.sh
```

## Prevention Tips

1. **Keep Docker Updated**: Use Docker Desktop 4.0+ or Docker CE 20.10+
2. **Monitor Resources**: Ensure adequate free disk space (>5GB) and memory (>2GB)
3. **Clean Regularly**: Run `docker system prune` weekly
4. **Use .dockerignore**: Exclude unnecessary files from build context
5. **Stable Network**: Ensure reliable internet connection during builds

## Getting Help

If these solutions don't work:
1. Check Docker version: `docker --version`
2. Check available resources: `df -h` and `free -h`
3. Review Docker logs: `docker compose logs`
4. Try building on a different machine/environment

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `DOCKER_BUILDKIT` | `1` | Enable/disable Docker BuildKit |
| `COMPOSE_DOCKER_CLI_BUILD` | `1` | Use Docker CLI for builds |
| `WEB_PORT` | `8080` | External port for frontend |

These variables can be set in your `.env` file or passed as environment variables.