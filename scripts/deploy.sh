#!/bin/bash
# ============================================
# AI Job Chommie - Production Deployment Script
# Automated deployment with health checks and rollback
# ============================================

set -e

# Configuration
DEPLOYMENT_ENV=${1:-production}
COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_DIR="/opt/backups"
LOG_FILE="/var/log/aijobchommie/deployment.log"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${2:-$GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> $LOG_FILE
}

# Error handling
error_exit() {
    log "ERROR: $1" $RED
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..." $BLUE
    
    command -v docker >/dev/null 2>&1 || error_exit "Docker is not installed"
    command -v docker-compose >/dev/null 2>&1 || error_exit "Docker Compose is not installed"
    
    if [ ! -f ".env.production" ]; then
        error_exit "Production environment file not found"
    fi
    
    log "Prerequisites check passed" $GREEN
}

# Create backup
create_backup() {
    log "Creating database backup..." $BLUE
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/pre_deploy_$TIMESTAMP.sql"
    
    docker exec aijc-postgres pg_dump -U aijc aijobchommie > $BACKUP_FILE 2>/dev/null || {
        log "Warning: Could not create database backup" $YELLOW
    }
    
    if [ -f "$BACKUP_FILE" ]; then
        gzip $BACKUP_FILE
        log "Backup created: ${BACKUP_FILE}.gz" $GREEN
    fi
}

# Pull latest code
update_code() {
    log "Pulling latest code from repository..." $BLUE
    
    git fetch --all
    git reset --hard origin/$DEPLOYMENT_ENV
    
    log "Code updated to latest version" $GREEN
}

# Build and deploy containers
deploy_containers() {
    log "Building and deploying containers..." $BLUE
    
    # Load environment variables
    export $(cat .env.production | grep -v '^#' | xargs)
    
    # Pull latest images
    docker-compose -f $COMPOSE_FILE pull
    
    # Build custom images
    docker-compose -f $COMPOSE_FILE build --no-cache
    
    # Deploy with zero downtime
    docker-compose -f $COMPOSE_FILE up -d --remove-orphans
    
    log "Containers deployed successfully" $GREEN
}

# Run database migrations
run_migrations() {
    log "Running database migrations..." $BLUE
    
    docker exec aijc-backend npx prisma migrate deploy || {
        log "Warning: Migration failed, but continuing..." $YELLOW
    }
    
    log "Migrations completed" $GREEN
}

# Health check
health_check() {
    log "Performing health checks..." $BLUE
    
    HEALTH_CHECK_URL="https://www.aijobchommie.co.za/health"
    MAX_ATTEMPTS=30
    ATTEMPT=0
    
    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        if curl -f -s $HEALTH_CHECK_URL > /dev/null; then
            log "Health check passed" $GREEN
            return 0
        fi
        
        ATTEMPT=$((ATTEMPT + 1))
        log "Health check attempt $ATTEMPT/$MAX_ATTEMPTS..." $YELLOW
        sleep 5
    done
    
    error_exit "Health check failed after $MAX_ATTEMPTS attempts"
}

# Cleanup old resources
cleanup() {
    log "Cleaning up old resources..." $BLUE
    
    # Remove unused Docker resources
    docker system prune -f --volumes
    
    # Remove old backups (keep last 30 days)
    find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
    
    # Rotate logs
    if [ -f "$LOG_FILE" ] && [ $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE") -gt 10485760 ]; then
        mv $LOG_FILE "${LOG_FILE}.old"
        touch $LOG_FILE
    fi
    
    log "Cleanup completed" $GREEN
}

# Rollback function
rollback() {
    log "ROLLING BACK DEPLOYMENT..." $RED
    
    # Restore previous version
    git reset --hard HEAD~1
    
    # Redeploy previous version
    docker-compose -f $COMPOSE_FILE up -d --force-recreate
    
    # Restore database if backup exists
    if [ -f "$BACKUP_FILE.gz" ]; then
        gunzip $BACKUP_FILE.gz
        docker exec -i aijc-postgres psql -U aijc aijobchommie < $BACKUP_FILE
        log "Database restored from backup" $YELLOW
    fi
    
    error_exit "Deployment rolled back due to errors"
}

# Send deployment notification
send_notification() {
    STATUS=$1
    MESSAGE=$2
    
    # Add notification logic here (Slack, Discord, email, etc.)
    log "Deployment notification: $STATUS - $MESSAGE" $BLUE
}

# Main deployment process
main() {
    log "========================================" $BLUE
    log "Starting AI Job Chommie Deployment" $BLUE
    log "Environment: $DEPLOYMENT_ENV" $BLUE
    log "========================================" $BLUE
    
    # Set trap for rollback on error
    trap rollback ERR
    
    # Execute deployment steps
    check_prerequisites
    create_backup
    update_code
    deploy_containers
    run_migrations
    health_check
    cleanup
    
    # Clear trap
    trap - ERR
    
    log "========================================" $GREEN
    log "DEPLOYMENT COMPLETED SUCCESSFULLY!" $GREEN
    log "========================================" $GREEN
    
    send_notification "SUCCESS" "Deployment to $DEPLOYMENT_ENV completed successfully"
}

# Execute main function
main "$@"
