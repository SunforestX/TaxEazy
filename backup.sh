#!/bin/bash
# =============================================================================
# TaxEazy Database Backup Script
# =============================================================================
# Cron example (runs daily at 2 AM):
# 0 2 * * * cd /opt/taxeazy && ./backup.sh >> /var/log/taxeazy-backup.log 2>&1
#
# Remember to make this script executable:
# chmod +x /path/to/backup.sh
#
# RESTORATION:
#   1. List backups: ls -la /opt/taxeazy/backups/
#   2. Restore: gunzip -c /opt/taxeazy/backups/BACKUP_FILE.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB
#   3. Verify: docker compose -f docker-compose.prod.yml exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT count(*) FROM users;"
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
BACKUP_DIR="${BACKUP_DIR:-/opt/taxeazy/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
COMPOSE_FILE=docker-compose.prod.yml

# Read PostgreSQL credentials from .env.production or use defaults
if [[ -f .env.production ]]; then
    # Source the file and extract variables
    set -a
    source .env.production
    set +a
fi

POSTGRES_USER="${POSTGRES_USER:-sunforest}"
POSTGRES_DB="${POSTGRES_DB:-sunforest}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="taxeazy_backup_${TIMESTAMP}.sql.gz"

# Colors for output (disabled when not running in a terminal for clean log output)
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    NC=''
fi

# -----------------------------------------------------------------------------
# Functions
# -----------------------------------------------------------------------------

log_info() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${RED}[ERROR]${NC} $1"
}

# -----------------------------------------------------------------------------
# Pre-checks
# -----------------------------------------------------------------------------

log_info "Starting TaxEazy database backup..."
log_info "Configuration:"
log_info "  Backup directory: $BACKUP_DIR"
log_info "  Retention days: $BACKUP_RETENTION_DAYS"
log_info "  Compose file: $COMPOSE_FILE"
log_info "  PostgreSQL user: $POSTGRES_USER"
log_info "  PostgreSQL database: $POSTGRES_DB"

# Verify backup directory exists, create if not
if [[ ! -d "$BACKUP_DIR" ]]; then
    log_info "Creating backup directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
    log_success "Backup directory created"
else
    log_info "Backup directory exists: $BACKUP_DIR"
fi

# Verify postgres container is running
log_info "Checking if postgres container is running..."
if ! docker compose -f "$COMPOSE_FILE" ps postgres 2>/dev/null | grep -q "Up"; then
    log_error "Postgres container is not running"
    log_error "Please ensure the database container is started before running backup"
    exit 1
fi
log_success "Postgres container is running"

# -----------------------------------------------------------------------------
# Perform Backup
# -----------------------------------------------------------------------------

log_info "Starting database backup..."
log_info "Backup file: $BACKUP_FILE"

if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$BACKUP_DIR/$BACKUP_FILE"; then
    log_success "Database backup completed"
else
    log_error "Database backup failed"
    rm -f "$BACKUP_DIR/$BACKUP_FILE"
    exit 1
fi

# -----------------------------------------------------------------------------
# Verify Backup
# -----------------------------------------------------------------------------

log_info "Verifying backup file..."

if [[ ! -f "$BACKUP_DIR/$BACKUP_FILE" ]]; then
    log_error "Backup file not found: $BACKUP_DIR/$BACKUP_FILE"
    exit 1
fi

BACKUP_SIZE=$(stat -f%z "$BACKUP_DIR/$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_DIR/$BACKUP_FILE" 2>/dev/null || echo "0")

if [[ "$BACKUP_SIZE" -eq 0 ]]; then
    log_error "Backup file is empty: $BACKUP_DIR/$BACKUP_FILE"
    rm -f "$BACKUP_DIR/$BACKUP_FILE"
    exit 1
fi

log_success "Backup verified: $BACKUP_DIR/$BACKUP_FILE"

# -----------------------------------------------------------------------------
# Cleanup Old Backups
# -----------------------------------------------------------------------------

log_info "Cleaning up backups older than $BACKUP_RETENTION_DAYS days..."

# Count files before cleanup
BACKUPS_BEFORE=$(find "$BACKUP_DIR" -name "taxeazy_backup_*.sql.gz" 2>/dev/null | wc -l | tr -d ' ')

# Delete old backups
find "$BACKUP_DIR" -name "taxeazy_backup_*.sql.gz" -mtime +"$BACKUP_RETENTION_DAYS" -delete 2>/dev/null || true

# Count files after cleanup
BACKUPS_AFTER=$(find "$BACKUP_DIR" -name "taxeazy_backup_*.sql.gz" 2>/dev/null | wc -l | tr -d ' ')
BACKUPS_DELETED=$((BACKUPS_BEFORE - BACKUPS_AFTER))

if [[ "$BACKUPS_DELETED" -gt 0 ]]; then
    log_info "Deleted $BACKUPS_DELETED old backup(s)"
else
    log_info "No old backups to delete"
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------

# Format file size for display
format_size() {
    local size=$1
    if [[ $size -ge 1073741824 ]]; then
        echo "$(echo "scale=2; $size / 1073741824" | bc) GB"
    elif [[ $size -ge 1048576 ]]; then
        echo "$(echo "scale=2; $size / 1048576" | bc) MB"
    elif [[ $size -ge 1024 ]]; then
        echo "$(echo "scale=2; $size / 1024" | bc) KB"
    else
        echo "$size bytes"
    fi
}

FORMATTED_SIZE=$(format_size "$BACKUP_SIZE")

echo ""
echo "========================================"
log_success "BACKUP SUMMARY"
echo "========================================"
echo -e "  ${GREEN}Backup file:${NC}    $BACKUP_DIR/$BACKUP_FILE"
echo -e "  ${GREEN}File size:${NC}      $FORMATTED_SIZE"
echo -e "  ${GREEN}Backups retained:${NC} $BACKUPS_AFTER"
echo "========================================"
echo ""

log_success "Backup completed successfully at $(date)"
exit 0
