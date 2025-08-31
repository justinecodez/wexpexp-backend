#!/bin/bash

# Tanzania Event Platform Deployment Script
# For server1.ufumbuzilabs.com (203.161.60.72)

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="tanzania-event-platform"
REPO_URL="https://github.com/yourusername/tanzania-event-platform-backend.git"  # Update with your repo
DEPLOY_DIR="/opt/tanzania-event-platform"
BACKUP_DIR="/opt/backups"
LOG_FILE="/var/log/deploy.log"

# Functions
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a $LOG_FILE
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a $LOG_FILE
    exit 1
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a $LOG_FILE
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}" | tee -a $LOG_FILE
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root for security reasons"
    fi
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
    fi
    
    # Check if Git is installed
    if ! command -v git &> /dev/null; then
        error "Git is not installed. Please install Git first."
    fi
    
    log "Prerequisites check passed"
}

# Create necessary directories
setup_directories() {
    log "Setting up directories..."
    
    sudo mkdir -p $DEPLOY_DIR
    sudo mkdir -p $BACKUP_DIR
    sudo mkdir -p /var/log/nginx
    sudo mkdir -p /opt/ssl/certbot
    
    # Set ownership
    sudo chown -R $USER:$USER $DEPLOY_DIR
    sudo chown -R $USER:$USER $BACKUP_DIR
    
    log "Directories created successfully"
}

# Clone or update repository
update_code() {
    log "Updating code..."
    
    if [ -d "$DEPLOY_DIR/.git" ]; then
        cd $DEPLOY_DIR
        git fetch origin
        git reset --hard origin/main  # or master, depending on your default branch
        log "Code updated from repository"
    else
        git clone $REPO_URL $DEPLOY_DIR
        cd $DEPLOY_DIR
        log "Repository cloned successfully"
    fi
}

# Setup environment
setup_environment() {
    log "Setting up environment..."
    
    # Copy production environment file
    if [ ! -f "$DEPLOY_DIR/.env" ]; then
        cp $DEPLOY_DIR/production.env $DEPLOY_DIR/.env
        warn "Please edit $DEPLOY_DIR/.env with your production values"
    fi
    
    # Generate secure secrets if not set
    if grep -q "change-this" $DEPLOY_DIR/.env; then
        warn "Generating secure secrets..."
        
        # Generate JWT secrets
        JWT_SECRET=$(openssl rand -hex 64)
        JWT_REFRESH_SECRET=$(openssl rand -hex 64)
        DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
        
        # Update .env file
        sed -i "s/your-super-secure-production-jwt-key-change-this-immediately/$JWT_SECRET/g" $DEPLOY_DIR/.env
        sed -i "s/your-super-secure-production-refresh-key-change-this-too/$JWT_REFRESH_SECRET/g" $DEPLOY_DIR/.env
        sed -i "s/YourSecureDBPassword123!/$DB_PASSWORD/g" $DEPLOY_DIR/.env
        
        log "Secure secrets generated"
    fi
}

# Database backup
backup_database() {
    log "Creating database backup..."
    
    BACKUP_FILE="$BACKUP_DIR/db_backup_$(date +%Y%m%d_%H%M%S).sql"
    
    if docker ps | grep -q "tanzania.*db"; then
        docker exec tanzania-event-platform-db-1 pg_dump -U tanzaniaevents tanzania_event_platform > $BACKUP_FILE
        log "Database backup created: $BACKUP_FILE"
    else
        warn "Database container not running, skipping backup"
    fi
}

# Deploy application
deploy_app() {
    log "Deploying application..."
    
    cd $DEPLOY_DIR
    
    # Pull latest images
    docker-compose -f docker-compose.prod.yml pull
    
    # Build application
    docker-compose -f docker-compose.prod.yml build --no-cache
    
    # Stop existing containers
    docker-compose -f docker-compose.prod.yml down
    
    # Start new containers
    docker-compose -f docker-compose.prod.yml up -d
    
    log "Application deployed successfully"
}

# Setup SSL certificates
setup_ssl() {
    log "Setting up SSL certificates..."
    
    # Create initial certificate
    docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email admin@ufumbuzilabs.com \
        --agree-tos \
        --no-eff-email \
        -d server1.ufumbuzilabs.com
    
    # Reload nginx
    docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
    
    log "SSL certificates configured"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    # Wait for database to be ready
    sleep 10
      
    # Seed database if needed
    docker-compose -f docker-compose.prod.yml exec api npm run db:seed
    
    log "Database migrations completed"
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Wait a bit for services to start
    sleep 30
    
    # Check if API is responding
    if curl -f http://localhost/health > /dev/null 2>&1; then
        log "Health check passed - API is responding"
    else
        error "Health check failed - API is not responding"
    fi
    
    # Check if database is healthy
    if docker-compose -f docker-compose.prod.yml exec db pg_isready -U tanzaniaevents > /dev/null 2>&1; then
        log "Database health check passed"
    else
        error "Database health check failed"
    fi
}

# Setup monitoring and logs
setup_monitoring() {
    log "Setting up monitoring and logs..."
    
    # Setup log rotation
    sudo tee /etc/logrotate.d/tanzania-event-platform > /dev/null <<EOF
/var/log/tanzania-event-platform/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
}
EOF
    
    # Setup cron for backups
    (crontab -l 2>/dev/null; echo "0 2 * * * $DEPLOY_DIR/scripts/backup.sh") | crontab -
    
    log "Monitoring and logs configured"
}

# Main deployment function
main() {
    log "Starting deployment of Tanzania Event Platform..."
    
    check_root
    check_prerequisites
    setup_directories
    update_code
    setup_environment
    backup_database
    deploy_app
    run_migrations
    health_check
    setup_monitoring
    
    log "Deployment completed successfully!"
    info "Application is available at: https://server1.ufumbuzilabs.com"
    info "API documentation: https://server1.ufumbuzilabs.com/api"
    info "Health check: https://server1.ufumbuzilabs.com/health"
    
    echo ""
    echo -e "${GREEN}🎉 Tanzania Event Platform deployed successfully!${NC}"
    echo -e "${BLUE}📊 Monitor logs with: docker-compose -f docker-compose.prod.yml logs -f${NC}"
    echo -e "${BLUE}🔧 Manage services with: docker-compose -f docker-compose.prod.yml [start|stop|restart]${NC}"
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "update")
        update_code
        deploy_app
        health_check
        ;;
    "backup")
        backup_database
        ;;
    "ssl")
        setup_ssl
        ;;
    "logs")
        cd $DEPLOY_DIR
        docker-compose -f docker-compose.prod.yml logs -f
        ;;
    "status")
        cd $DEPLOY_DIR
        docker-compose -f docker-compose.prod.yml ps
        ;;
    *)
        echo "Usage: $0 {deploy|update|backup|ssl|logs|status}"
        exit 1
        ;;
esac

