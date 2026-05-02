#!/bin/bash

# TaxEazy SSL Certificate Initialization Script
# This script initializes Let's Encrypt SSL certificates using Certbot

set -e

# Configuration
DOMAIN="${DOMAIN:-tax.sunforestx.com.au}"
EMAIL="${EMAIL:-admin@tax.sunforestx.com.au}"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
CERTBOT_CONF="/etc/letsencrypt"
CERTBOT_WWW="/var/www/certbot"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if certificates already exist
check_existing_certs() {
    if [ -d "$CERT_DIR" ]; then
        if [ -f "${CERT_DIR}/fullchain.pem" ] && [ -f "${CERT_DIR}/privkey.pem" ]; then
            log_info "SSL certificates already exist at ${CERT_DIR}"
            return 0
        fi
    fi
    return 1
}

# Create temporary self-signed certificate for initial Nginx startup
create_self_signed_cert() {
    log_info "Creating temporary self-signed certificate for ${DOMAIN}..."
    
    mkdir -p "${CERT_DIR}"
    
    openssl req -x509 \
        -nodes \
        -days 1 \
        -newkey rsa:2048 \
        -keyout "${CERT_DIR}/privkey.pem" \
        -out "${CERT_DIR}/fullchain.pem" \
        -subj "/CN=${DOMAIN}" \
        2>/dev/null
    
    log_info "Temporary self-signed certificate created successfully"
}

# Start Nginx in background
start_nginx() {
    log_info "Starting Nginx..."
    nginx -g 'daemon on;'
    sleep 2
    
    if ! pgrep nginx > /dev/null; then
        log_error "Failed to start Nginx"
        exit 1
    fi
    
    log_info "Nginx started successfully"
}

# Obtain real certificates from Let's Encrypt
obtain_real_certs() {
    log_info "Obtaining SSL certificates from Let's Encrypt for ${DOMAIN}..."
    
    certbot certonly \
        --webroot \
        --webroot-path "${CERTBOT_WWW}" \
        --email "${EMAIL}" \
        --agree-tos \
        --no-eff-email \
        --non-interactive \
        -d "${DOMAIN}"
    
    if [ $? -eq 0 ]; then
        log_info "SSL certificates obtained successfully!"
        return 0
    else
        log_error "Failed to obtain SSL certificates"
        return 1
    fi
}

# Reload Nginx with real certificates
reload_nginx() {
    log_info "Reloading Nginx with real certificates..."
    nginx -s reload
    log_info "Nginx reloaded successfully"
}

# Main execution
main() {
    log_info "Starting SSL certificate initialization for ${DOMAIN}"
    log_info "Using email: ${EMAIL}"
    
    # Check if certificates already exist
    if check_existing_certs; then
        log_info "Certificates already exist. No action needed."
        log_info "If you want to renew certificates, run: certbot renew"
        exit 0
    fi
    
    # Create self-signed cert for initial Nginx startup
    create_self_signed_cert
    
    # Start Nginx
    start_nginx
    
    # Obtain real certificates
    if obtain_real_certs; then
        # Reload Nginx with real certificates
        reload_nginx
        log_info "SSL certificate initialization completed successfully!"
    else
        log_error "SSL certificate initialization failed"
        log_warn "Nginx is running with temporary self-signed certificate"
        exit 1
    fi
}

# Run main function
main "$@"
