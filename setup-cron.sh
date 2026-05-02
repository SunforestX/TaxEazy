#!/bin/bash
# =============================================================================
# TaxEazy Backup Cron Job Setup
# =============================================================================
# Installs a cron job to run automated daily backups at 2 AM.
# Safe to run multiple times (idempotent).
# =============================================================================

set -euo pipefail

# Configuration
TAXEAZY_DIR="${TAXEAZY_DIR:-/opt/taxeazy}"
CRON_SCHEDULE="0 2 * * *"
CRON_COMMAND="cd ${TAXEAZY_DIR} && ./backup.sh >> /var/log/taxeazy-backup.log 2>&1"
CRON_ENTRY="${CRON_SCHEDULE} ${CRON_COMMAND}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "[INFO] TaxEazy Backup Cron Setup"
echo "[INFO] Install directory: ${TAXEAZY_DIR}"
echo ""

# Check if backup.sh exists
if [[ ! -f "${TAXEAZY_DIR}/backup.sh" ]]; then
    echo -e "${YELLOW}[WARNING]${NC} backup.sh not found at ${TAXEAZY_DIR}/backup.sh"
    echo "[INFO] Make sure TaxEazy is installed at ${TAXEAZY_DIR}"
    exit 1
fi

# Ensure backup.sh is executable
chmod +x "${TAXEAZY_DIR}/backup.sh"

# Check if cron job already exists
EXISTING_CRON=$(crontab -l 2>/dev/null || true)

if echo "$EXISTING_CRON" | grep -qF "taxeazy" && echo "$EXISTING_CRON" | grep -qF "backup.sh"; then
    echo -e "${YELLOW}[WARNING]${NC} TaxEazy backup cron job already exists. Skipping installation."
    echo "[INFO] Current cron entry:"
    echo "$EXISTING_CRON" | grep "backup.sh"
    echo ""
    echo -e "${GREEN}[SUCCESS]${NC} No changes made."
    exit 0
fi

# Install cron job
if [[ -z "$EXISTING_CRON" ]]; then
    echo "$CRON_ENTRY" | crontab -
else
    (echo "$EXISTING_CRON"; echo "$CRON_ENTRY") | crontab -
fi

# Create log file if it doesn't exist
touch /var/log/taxeazy-backup.log 2>/dev/null || true

echo -e "${GREEN}[SUCCESS]${NC} Cron job installed successfully!"
echo ""
echo "  Schedule: Daily at 2:00 AM"
echo "  Command:  ${CRON_COMMAND}"
echo "  Log file: /var/log/taxeazy-backup.log"
echo ""
echo "[INFO] Verify with: crontab -l"
echo "[INFO] Test backup manually: cd ${TAXEAZY_DIR} && ./backup.sh"
