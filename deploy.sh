#!/bin/bash
# NOTE: Run 'chmod +x deploy.sh' before executing this script
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
SEED_FLAG=false
for arg in "$@"; do
    if [[ "$arg" == "--seed" ]]; then
        SEED_FLAG=true
    fi
done

# Helper functions for colored output
print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_info() {
    echo -e "[INFO] $1"
}

# 1. Check prerequisites
print_info "Checking prerequisites..."

# Check Docker installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi
print_success "Docker is installed"

# Check Docker running
if ! docker info &> /dev/null; then
    print_error "Docker is not running. Please start Docker."
    exit 1
fi
print_success "Docker is running"

# Check Docker Compose v2
if ! docker compose version &> /dev/null; then
    print_error "Docker Compose v2 is not available. Please install Docker Compose v2."
    exit 1
fi
print_success "Docker Compose v2 is available ($(docker compose version --short))"

# 2. Check .env.production exists
print_info "Checking for .env.production file..."

if [[ ! -f "/Volumes/KESU/TaxEazy/.env.production" ]]; then
    print_error ".env.production file not found at /Volumes/KESU/TaxEazy/.env.production"
    print_error "Please create .env.production with required environment variables before deploying."
    exit 1
fi
print_success ".env.production file found"

# 3. Build and start containers
print_info "Building and starting containers..."

docker compose -f docker-compose.prod.yml up -d --build

print_success "Containers built and started"

# 4. Wait for postgres to be healthy
print_info "Waiting for PostgreSQL to be healthy..."

MAX_WAIT=30
WAIT_COUNT=0
while [[ $WAIT_COUNT -lt $MAX_WAIT ]]; do
    if docker compose -f docker-compose.prod.yml exec -T postgres pg_isready -U postgres &> /dev/null; then
        print_success "PostgreSQL is healthy"
        break
    fi
    WAIT_COUNT=$((WAIT_COUNT + 1))
    sleep 1
done

if [[ $WAIT_COUNT -ge $MAX_WAIT ]]; then
    print_error "PostgreSQL did not become healthy within 30 seconds"
    exit 1
fi

# 5. Run Alembic migrations
print_info "Running database migrations..."

docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head

print_success "Database migrations completed"

# 6. Seed data (only if --seed flag passed)
if [[ "$SEED_FLAG" == true ]]; then
    print_info "Seeding database..."
    docker compose -f docker-compose.prod.yml exec -T backend python -m app.seed
    print_success "Database seeded"
else
    print_info "Skipping database seed (use --seed flag to seed)"
fi

# 7. SSL setup (only if certs don't exist)
print_info "Checking SSL certificates..."

SSL_CERT_PATH="/etc/letsencrypt/live/tax.sunforestx.com.au"
SSL_INITIALIZED_MARKER="./ssl-initialized"

if [[ -d "$SSL_CERT_PATH" ]]; then
    print_success "SSL certificates already exist at $SSL_CERT_PATH"
elif [[ -f "$SSL_INITIALIZED_MARKER" ]]; then
    print_success "SSL certificates already configured (marker file exists)"
else
    print_warning "SSL certificates not found. Running SSL setup..."
    
    if [[ -f "/Volumes/KESU/TaxEazy/nginx/certbot-init.sh" ]]; then
        bash /Volumes/KESU/TaxEazy/nginx/certbot-init.sh
        touch "$SSL_INITIALIZED_MARKER"
        print_success "SSL setup completed"
    else
        print_warning "certbot-init.sh not found. Please run SSL setup manually."
    fi
fi

# 8. Health check
print_info "Running health check..."

HEALTH_URL="http://localhost/health"
MAX_HEALTH_RETRIES=5
HEALTH_RETRY_COUNT=0

while [[ $HEALTH_RETRY_COUNT -lt $MAX_HEALTH_RETRIES ]]; do
    if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
        print_success "Health check passed - API is responding"
        break
    fi
    HEALTH_RETRY_COUNT=$((HEALTH_RETRY_COUNT + 1))
    sleep 2
done

if [[ $HEALTH_RETRY_COUNT -ge $MAX_HEALTH_RETRIES ]]; then
    print_error "Health check failed - API not responding at $HEALTH_URL"
    print_warning "Check container logs with: docker compose -f docker-compose.prod.yml logs backend"
    exit 1
fi

# 9. Setup backup directory
print_info "Checking backup directory..."

BACKUP_DIR="/opt/taxeazy/backups"
if [[ ! -d "$BACKUP_DIR" ]]; then
    mkdir -p "$BACKUP_DIR" 2>/dev/null || true
    if [[ -d "$BACKUP_DIR" ]]; then
        print_success "Backup directory created: $BACKUP_DIR"
    else
        print_warning "Could not create backup directory: $BACKUP_DIR (may need sudo)"
    fi
else
    print_success "Backup directory exists: $BACKUP_DIR"
fi

# 10. Print summary
echo ""
echo "=============================================="
echo -e "${GREEN}DEPLOYMENT SUCCESSFUL${NC}"
echo "=============================================="
echo ""
echo "Deployment URLs:"
echo "  - API:     http://localhost:8000"
echo "  - Frontend: http://localhost:3000"
echo ""
echo "Container Status:"
docker compose -f docker-compose.prod.yml ps
echo ""
echo "Useful Commands:"
echo "  - View logs:     docker compose -f docker-compose.prod.yml logs -f"
echo "  - Stop services: docker compose -f docker-compose.prod.yml down"
echo "  - Restart:       docker compose -f docker-compose.prod.yml restart"
echo ""
echo "Backup Automation:"
echo "  - Run './setup-cron.sh' to install automated daily backups"
echo "  - Manual backup: cd /opt/taxeazy && ./backup.sh"
echo ""
print_success "Deployment completed at $(date)"
