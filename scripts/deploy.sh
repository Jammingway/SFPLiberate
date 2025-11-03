#!/bin/bash
# Production Deployment Script for SFPLiberate
# Usage: ./scripts/deploy.sh [options]
#
# Options:
#   --no-backup     Skip database backup
#   --skip-health   Skip health checks
#   --rollback      Rollback to previous version
#   --help          Show this help message

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="sfpliberate"
COMPOSE_FILE="docker-compose.yml"
BACKUP_DIR="./backups"
HEALTH_CHECK_TIMEOUT=60
HEALTH_CHECK_INTERVAL=5

# Parse command line arguments
DO_BACKUP=true
DO_HEALTH_CHECK=true
DO_ROLLBACK=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --no-backup)
      DO_BACKUP=false
      shift
      ;;
    --skip-health)
      DO_HEALTH_CHECK=false
      shift
      ;;
    --rollback)
      DO_ROLLBACK=true
      shift
      ;;
    --help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --no-backup     Skip database backup"
      echo "  --skip-health   Skip health checks"
      echo "  --rollback      Rollback to previous version"
      echo "  --help          Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Helper functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
  log_info "Checking Docker..."
  if ! docker info > /dev/null 2>&1; then
    log_error "Docker is not running. Please start Docker and try again."
    exit 1
  fi
  log_success "Docker is running"
}

# Check if docker-compose is available
check_docker_compose() {
  log_info "Checking docker-compose..."
  if ! command -v docker-compose &> /dev/null; then
    log_error "docker-compose is not installed. Please install it and try again."
    exit 1
  fi
  log_success "docker-compose is available"
}

# Backup database
backup_database() {
  if [ "$DO_BACKUP" = false ]; then
    log_warning "Skipping database backup (--no-backup flag)"
    return 0
  fi

  log_info "Creating database backup..."
  mkdir -p "$BACKUP_DIR"
  
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  BACKUP_FILE="$BACKUP_DIR/sfp_library_${TIMESTAMP}.db"
  
  if docker-compose exec -T backend cat /app/data/sfp_library.db > "$BACKUP_FILE" 2>/dev/null; then
    log_success "Database backed up to $BACKUP_FILE"
    
    # Keep only last 10 backups
    ls -t "$BACKUP_DIR"/*.db 2>/dev/null | tail -n +11 | xargs -r rm
    log_info "Cleaned up old backups (keeping last 10)"
  else
    log_warning "Could not backup database (service may not be running)"
  fi
}

# Pull latest images
pull_images() {
  log_info "Pulling latest images..."
  if docker-compose pull; then
    log_success "Images pulled successfully"
  else
    log_error "Failed to pull images"
    exit 1
  fi
}

# Build images
build_images() {
  log_info "Building images..."
  
  export VERSION=$(git describe --tags --always --dirty 2>/dev/null || echo "dev")
  export BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  export VCS_REF=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
  
  log_info "Version: $VERSION"
  log_info "Build Date: $BUILD_DATE"
  log_info "VCS Ref: $VCS_REF"
  
  if docker-compose build --parallel; then
    log_success "Images built successfully"
  else
    log_error "Failed to build images"
    exit 1
  fi
}

# Stop old containers (gracefully)
stop_containers() {
  log_info "Stopping old containers..."
  docker-compose stop
  log_success "Containers stopped"
}

# Start new containers
start_containers() {
  log_info "Starting new containers..."
  if docker-compose up -d; then
    log_success "Containers started"
  else
    log_error "Failed to start containers"
    exit 1
  fi
}

# Wait for service to be healthy
wait_for_health() {
  local service=$1
  local url=$2
  local elapsed=0
  
  log_info "Waiting for $service to be healthy..."
  
  while [ $elapsed -lt $HEALTH_CHECK_TIMEOUT ]; do
    if curl -f "$url" > /dev/null 2>&1; then
      log_success "$service is healthy"
      return 0
    fi
    
    sleep $HEALTH_CHECK_INTERVAL
    elapsed=$((elapsed + HEALTH_CHECK_INTERVAL))
    echo -ne "\rWaiting... ${elapsed}s / ${HEALTH_CHECK_TIMEOUT}s"
  done
  
  echo ""
  log_error "$service failed health check (timeout after ${HEALTH_CHECK_TIMEOUT}s)"
  return 1
}

# Run health checks
health_checks() {
  if [ "$DO_HEALTH_CHECK" = false ]; then
    log_warning "Skipping health checks (--skip-health flag)"
    return 0
  fi

  log_info "Running health checks..."
  
  # Wait a bit for containers to initialize
  sleep 5
  
  # Check backend
  if ! wait_for_health "Backend" "http://localhost:8080/api/modules"; then
    log_error "Backend health check failed"
    show_logs
    return 1
  fi
  
  # Check frontend
  if ! wait_for_health "Frontend" "http://localhost:8080/"; then
    log_error "Frontend health check failed"
    show_logs
    return 1
  fi
  
  log_success "All health checks passed"
}

# Show container status
show_status() {
  log_info "Container status:"
  docker-compose ps
}

# Show recent logs
show_logs() {
  log_info "Recent logs:"
  docker-compose logs --tail=50
}

# Tag current images as last known good
tag_current_as_previous() {
  log_info "Tagging current images as 'previous' for rollback..."
  
  # Check if current images exist
  if docker image inspect sfpliberate-backend:latest &>/dev/null; then
    docker tag sfpliberate-backend:latest sfpliberate-backend:previous
    log_success "Tagged backend:latest as backend:previous"
  else
    log_warning "No existing backend:latest image found"
  fi
  
  if docker image inspect sfpliberate-frontend:latest &>/dev/null; then
    docker tag sfpliberate-frontend:latest sfpliberate-frontend:previous
    log_success "Tagged frontend:latest as frontend:previous"
  else
    log_warning "No existing frontend:latest image found"
  fi
}

# Rollback to previous version
rollback() {
  log_warning "Rolling back to previous version..."
  
  # Check for explicitly tagged previous images
  PREVIOUS_BACKEND="sfpliberate-backend:previous"
  PREVIOUS_FRONTEND="sfpliberate-frontend:previous"
  
  if ! docker image inspect "$PREVIOUS_BACKEND" &>/dev/null || ! docker image inspect "$PREVIOUS_FRONTEND" &>/dev/null; then
    log_error "No previous images found for rollback"
    log_error "Rollback requires images tagged as 'previous'"
    log_error "This typically happens when deploying for the first time"
    exit 1
  fi
  
  log_info "Rolling back to:"
  log_info "  Backend: $PREVIOUS_BACKEND"
  log_info "  Frontend: $PREVIOUS_FRONTEND"
  
  # Stop current containers
  docker-compose down
  
  # Tag previous images as latest
  docker tag "$PREVIOUS_BACKEND" sfpliberate-backend:latest
  docker tag "$PREVIOUS_FRONTEND" sfpliberate-frontend:latest
  
  # Start with previous images
  docker-compose up -d
  
  log_success "Rollback complete"
  
  # Run health checks
  if ! health_checks; then
    log_error "Rollback health checks failed"
    exit 1
  fi
}

# Cleanup old images
cleanup() {
  log_info "Cleaning up old images..."
  docker image prune -f
  log_success "Cleanup complete"
}

# Main deployment flow
main() {
  echo ""
  echo "╔════════════════════════════════════════════════╗"
  echo "║   SFPLiberate Production Deployment Script    ║"
  echo "╚════════════════════════════════════════════════╝"
  echo ""
  
  # Pre-flight checks
  check_docker
  check_docker_compose
  
  if [ "$DO_ROLLBACK" = true ]; then
    rollback
    exit 0
  fi
  
  # Backup before deployment
  backup_database
  
  # Pull latest code (if in git repo)
  if [ -d .git ]; then
    log_info "Pulling latest code from git..."
    git pull || log_warning "Could not pull from git (may not be on a branch)"
  fi
  
  # Tag current images as previous (for rollback)
  tag_current_as_previous
  
  # Build new images
  build_images
  
  # Deploy with health checks
  log_info "Deploying new version..."
  
  # Start new containers
  start_containers
  
  # Run health checks
  if ! health_checks; then
    log_error "Deployment failed health checks"
    log_warning "Attempting automatic rollback..."
    rollback
    exit 1
  fi
  
  # Show status
  show_status
  
  # Cleanup
  cleanup
  
  echo ""
  log_success "╔════════════════════════════════════════════════╗"
  log_success "║      Deployment completed successfully!       ║"
  log_success "╚════════════════════════════════════════════════╝"
  echo ""
  log_info "Application is running at: http://localhost:8080"
  log_info "Use 'docker-compose logs -f' to follow logs"
  echo ""
}

# Trap errors and provide helpful message
trap 'log_error "Deployment failed. Check logs with: docker-compose logs"' ERR

# Run main function
main
