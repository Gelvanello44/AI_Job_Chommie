#!/bin/bash

# ============================================
# AI Job Chommie - Ultimate Deployment Script
# Production deployment with zero-downtime and rollback
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${1:-production}"
COMPOSE_FILE="${2:-docker-compose.ultimate.yml}"
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
MAX_RETRIES=30
RETRY_DELAY=10

# Functions
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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check environment file
    if [ ! -f ".env.${ENVIRONMENT}" ]; then
        log_error "Environment file .env.${ENVIRONMENT} not found"
        exit 1
    fi
    
    log_success "All prerequisites met"
}

# Backup current deployment
backup_current() {
    log_info "Creating backup of current deployment..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup database
    if docker ps | grep -q "aijc-postgres"; then
        log_info "Backing up database..."
        docker exec aijc-postgres pg_dumpall -U aijc > "$BACKUP_DIR/database.sql"
        log_success "Database backed up"
    fi
    
    # Backup volumes
    log_info "Backing up Docker volumes..."
    docker run --rm \
        -v postgres-data:/source:ro \
        -v "$BACKUP_DIR:/backup" \
        alpine tar czf /backup/postgres-data.tar.gz -C /source .
    
    docker run --rm \
        -v redis-data:/source:ro \
        -v "$BACKUP_DIR:/backup" \
        alpine tar czf /backup/redis-data.tar.gz -C /source .
    
    log_success "Backup completed at $BACKUP_DIR"
}

# Build images
build_images() {
    log_info "Building Docker images..."
    
    # Build with BuildKit for better caching
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1
    
    docker-compose -f "$COMPOSE_FILE" build --parallel
    
    log_success "Images built successfully"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    docker-compose -f "$COMPOSE_FILE" run --rm backend npx prisma migrate deploy
    
    log_success "Migrations completed"
}

# Health check for a service
health_check() {
    local service=$1
    local url=$2
    local retries=0
    
    log_info "Checking health of $service..."
    
    while [ $retries -lt $MAX_RETRIES ]; do
        if curl -f -s "$url" > /dev/null; then
            log_success "$service is healthy"
            return 0
        fi
        
        retries=$((retries + 1))
        log_warning "Waiting for $service to be healthy... ($retries/$MAX_RETRIES)"
        sleep $RETRY_DELAY
    done
    
    log_error "$service failed health check"
    return 1
}

# Deploy with zero-downtime
deploy_services() {
    log_info "Starting deployment..."
    
    # Load environment variables
    export $(cat ".env.${ENVIRONMENT}" | grep -v '^#' | xargs)
    
    # Start infrastructure services first
    log_info "Starting infrastructure services..."
    docker-compose -f "$COMPOSE_FILE" up -d \
        postgres redis rabbitmq
    
    # Wait for infrastructure
    sleep 10
    
    # Run migrations
    run_migrations
    
    # Start monitoring stack
    log_info "Starting monitoring services..."
    docker-compose -f "$COMPOSE_FILE" up -d \
        prometheus grafana loki promtail
    
    # Deploy backend with rolling update
    log_info "Deploying backend services..."
    docker-compose -f "$COMPOSE_FILE" up -d \
        --scale backend=2 \
        --no-recreate \
        backend worker job-scraper
    
    # Health check backend
    health_check "Backend API" "http://localhost:5000/health"
    
    # Deploy frontend with rolling update
    log_info "Deploying frontend..."
    docker-compose -f "$COMPOSE_FILE" up -d \
        --scale frontend=2 \
        --no-recreate \
        frontend
    
    # Health check frontend
    health_check "Frontend" "http://localhost/health"
    
    # Start load balancer
    log_info "Starting load balancer..."
    docker-compose -f "$COMPOSE_FILE" up -d traefik
    
    # Start backup service
    docker-compose -f "$COMPOSE_FILE" up -d backup
    
    log_success "Deployment completed successfully"
}

# Rollback deployment
rollback() {
    log_warning "Starting rollback..."
    
    if [ ! -d "$1" ]; then
        log_error "Backup directory $1 not found"
        exit 1
    fi
    
    # Stop current deployment
    docker-compose -f "$COMPOSE_FILE" down
    
    # Restore database
    if [ -f "$1/database.sql" ]; then
        log_info "Restoring database..."
        docker-compose -f "$COMPOSE_FILE" up -d postgres
        sleep 10
        docker exec -i aijc-postgres psql -U aijc < "$1/database.sql"
    fi
    
    # Restore volumes
    if [ -f "$1/postgres-data.tar.gz" ]; then
        log_info "Restoring volumes..."
        docker run --rm \
            -v postgres-data:/target \
            -v "$1:/backup:ro" \
            alpine tar xzf /backup/postgres-data.tar.gz -C /target
    fi
    
    # Restart services
    deploy_services
    
    log_success "Rollback completed"
}

# Run smoke tests
run_smoke_tests() {
    log_info "Running smoke tests..."
    
    # Test API endpoint
    if ! curl -f -s "http://localhost:5000/api/v1/health" > /dev/null; then
        log_error "API health check failed"
        return 1
    fi
    
    # Test frontend
    if ! curl -f -s "http://localhost/" > /dev/null; then
        log_error "Frontend check failed"
        return 1
    fi
    
    # Test database connection
    if ! docker exec aijc-postgres pg_isready -U aijc; then
        log_error "Database connection failed"
        return 1
    fi
    
    # Test Redis
    if ! docker exec aijc-redis redis-cli ping > /dev/null; then
        log_error "Redis connection failed"
        return 1
    fi
    
    log_success "All smoke tests passed"
}

# Show deployment status
show_status() {
    log_info "Deployment Status:"
    echo ""
    docker-compose -f "$COMPOSE_FILE" ps
    echo ""
    
    log_info "Service URLs:"
    echo "  Frontend: https://www.aijobchommie.co.za"
    echo "  API: https://api.aijobchommie.co.za"
    echo "  Grafana: https://grafana.aijobchommie.co.za"
    echo "  RabbitMQ: http://localhost:15672"
    echo ""
    
    log_info "Resource Usage:"
    docker stats --no-stream
}

# Main deployment flow
main() {
    log_info "Starting AI Job Chommie deployment for $ENVIRONMENT environment"
    
    # Check prerequisites
    check_prerequisites
    
    # Create backup
    backup_current
    
    # Build images
    build_images
    
    # Deploy services
    deploy_services
    
    # Run smoke tests
    if ! run_smoke_tests; then
        log_error "Smoke tests failed, initiating rollback..."
        rollback "$BACKUP_DIR"
        exit 1
    fi
    
    # Show status
    show_status
    
    log_success "🚀 AI Job Chommie is now live and ready!"
    log_info "Monitor the deployment at https://grafana.aijobchommie.co.za"
}

# Handle command line arguments
case "${3:-deploy}" in
    deploy)
        main
        ;;
    rollback)
        if [ -z "$4" ]; then
            log_error "Please specify backup directory for rollback"
            exit 1
        fi
        rollback "$4"
        ;;
    status)
        show_status
        ;;
    test)
        run_smoke_tests
        ;;
    *)
        echo "Usage: $0 <environment> <compose-file> [deploy|rollback|status|test] [backup-dir]"
        exit 1
        ;;
esac
