#!/bin/bash

# Database backup script for Nelo
# This script creates timestamped backups of the PostgreSQL database

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="${DB_NAME:-nelo}"
DB_USER="${DB_USER:-nelo}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/nelo_backup_${TIMESTAMP}.sql"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}🔒 Starting database backup...${NC}"
echo "Database: ${DB_NAME}"
echo "Host: ${DB_HOST}:${DB_PORT}"
echo "Backup location: ${BACKUP_FILE}"

# Check if running in Docker or native
if command -v docker &> /dev/null && docker ps | grep -q infra-db-1; then
    echo -e "${GREEN}📦 Using Docker container for backup${NC}"
    
    # Create backup using Docker
    docker exec infra-db-1 pg_dump \
        -U ${DB_USER} \
        -d ${DB_NAME} \
        --verbose \
        --clean \
        --if-exists \
        --no-owner \
        --no-privileges > "${BACKUP_FILE}"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Backup created successfully${NC}"
    else
        echo -e "${RED}❌ Backup failed${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}🖥️  Using native PostgreSQL for backup${NC}"
    
    # Create backup using native pg_dump
    PGPASSWORD="${DB_PASSWORD}" pg_dump \
        -h ${DB_HOST} \
        -p ${DB_PORT} \
        -U ${DB_USER} \
        -d ${DB_NAME} \
        --verbose \
        --clean \
        --if-exists \
        --no-owner \
        --no-privileges > "${BACKUP_FILE}"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Backup created successfully${NC}"
    else
        echo -e "${RED}❌ Backup failed${NC}"
        exit 1
    fi
fi

# Compress the backup
echo -e "${YELLOW}📦 Compressing backup...${NC}"
gzip "${BACKUP_FILE}"

# Calculate file size
BACKUP_SIZE=$(ls -lh "${BACKUP_FILE}.gz" | awk '{print $5}')

echo -e "${GREEN}✨ Backup complete!${NC}"
echo "File: ${BACKUP_FILE}.gz"
echo "Size: ${BACKUP_SIZE}"

# Clean up old backups (keep last 10)
echo -e "${YELLOW}🧹 Cleaning old backups...${NC}"
ls -t "${BACKUP_DIR}"/nelo_backup_*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -f

echo -e "${GREEN}📋 Available backups:${NC}"
ls -lh "${BACKUP_DIR}"/nelo_backup_*.sql.gz 2>/dev/null | head -10

# Restore instructions
echo ""
echo -e "${YELLOW}To restore from this backup:${NC}"
echo "gunzip < ${BACKUP_FILE}.gz | docker exec -i infra-db-1 psql -U ${DB_USER} -d ${DB_NAME}"
echo ""
echo -e "${YELLOW}Or for native PostgreSQL:${NC}"
echo "gunzip < ${BACKUP_FILE}.gz | psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME}"