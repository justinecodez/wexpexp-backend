#!/bin/bash

# Database Backup Script for Tanzania Event Platform
# Automated backup with rotation

set -e

# Configuration
BACKUP_DIR="/opt/backups"
DB_CONTAINER="tanzania-event-platform-db-1"
DB_USER="tanzaniaevents"
DB_NAME="tanzania_event_platform"
RETENTION_DAYS=30
LOG_FILE="/var/log/backup.log"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# Function to create backup
create_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/db_backup_$timestamp.sql"
    local compressed_file="$backup_file.gz"
    
    log "Starting database backup..."
    
    # Create database dump
    if docker exec $DB_CONTAINER pg_dump -U $DB_USER -d $DB_NAME > $backup_file; then
        # Compress the backup
        gzip $backup_file
        log "Backup created successfully: $compressed_file"
        
        # Get file size
        local size=$(du -h $compressed_file | cut -f1)
        log "Backup size: $size"
        
        return 0
    else
        log "ERROR: Failed to create database backup"
        return 1
    fi
}

# Function to clean old backups
cleanup_old_backups() {
    log "Cleaning up old backups (keeping last $RETENTION_DAYS days)..."
    
    # Find and delete backups older than retention period
    local deleted_count=$(find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
    
    if [ $deleted_count -gt 0 ]; then
        log "Deleted $deleted_count old backup files"
    else
        log "No old backups to delete"
    fi
}

# Function to verify backup integrity
verify_backup() {
    local latest_backup=$(ls -t $BACKUP_DIR/db_backup_*.sql.gz | head -n1)
    
    if [ -f "$latest_backup" ]; then
        log "Verifying backup integrity: $latest_backup"
        
        # Test if the gzip file is valid
        if gzip -t "$latest_backup"; then
            log "Backup integrity check passed"
            return 0
        else
            log "ERROR: Backup integrity check failed"
            return 1
        fi
    else
        log "ERROR: No backup file found for verification"
        return 1
    fi
}

# Function to send backup status notification (optional)
send_notification() {
    local status=$1
    local message=$2
    
    # You can customize this to send email, Slack, or other notifications
    if command -v mail &> /dev/null; then
        echo "$message" | mail -s "Tanzania Event Platform Backup - $status" admin@ufumbuzilabs.com
    fi
}

# Main backup process
main() {
    log "=== Starting backup process ==="
    
    # Check if database container is running
    if ! docker ps | grep -q $DB_CONTAINER; then
        log "ERROR: Database container is not running"
        send_notification "FAILED" "Database container is not running"
        exit 1
    fi
    
    # Create backup
    if create_backup; then
        # Verify backup
        if verify_backup; then
            # Cleanup old backups
            cleanup_old_backups
            
            log "=== Backup process completed successfully ==="
            send_notification "SUCCESS" "Database backup completed successfully"
        else
            log "=== Backup process failed during verification ==="
            send_notification "FAILED" "Backup verification failed"
            exit 1
        fi
    else
        log "=== Backup process failed ==="
        send_notification "FAILED" "Database backup creation failed"
        exit 1
    fi
    
    # Display backup statistics
    local backup_count=$(ls $BACKUP_DIR/db_backup_*.sql.gz 2>/dev/null | wc -l)
    local total_size=$(du -sh $BACKUP_DIR 2>/dev/null | cut -f1)
    
    log "Backup statistics:"
    log "- Total backups: $backup_count"
    log "- Total size: $total_size"
}

# Handle script arguments
case "${1:-backup}" in
    "backup")
        main
        ;;
    "list")
        echo "Available backups:"
        ls -lah $BACKUP_DIR/db_backup_*.sql.gz 2>/dev/null || echo "No backups found"
        ;;
    "restore")
        if [ -z "$2" ]; then
            echo "Usage: $0 restore <backup_file>"
            echo "Available backups:"
            ls $BACKUP_DIR/db_backup_*.sql.gz 2>/dev/null || echo "No backups found"
            exit 1
        fi
        
        backup_file="$2"
        if [ ! -f "$backup_file" ]; then
            echo "ERROR: Backup file not found: $backup_file"
            exit 1
        fi
        
        log "Restoring database from: $backup_file"
        
        # Stop the application
        docker-compose -f /opt/tanzania-event-platform/docker-compose.prod.yml stop api
        
        # Restore database
        gunzip -c "$backup_file" | docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME
        
        # Start the application
        docker-compose -f /opt/tanzania-event-platform/docker-compose.prod.yml start api
        
        log "Database restore completed"
        ;;
    "cleanup")
        cleanup_old_backups
        ;;
    *)
        echo "Usage: $0 {backup|list|restore|cleanup}"
        echo "  backup  - Create a new database backup"
        echo "  list    - List available backups"
        echo "  restore - Restore from a backup file"
        echo "  cleanup - Remove old backups"
        exit 1
        ;;
esac

