#!/bin/bash

# Database rollback script for Nelo
# This script helps rollback migrations and restore from backups

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

# Function to list available backups
list_backups() {
    echo -e "${YELLOW}📋 Available backups:${NC}"
    if ls "${BACKUP_DIR}"/nelo_backup_*.sql.gz 2>/dev/null | head -10; then
        ls -lh "${BACKUP_DIR}"/nelo_backup_*.sql.gz 2>/dev/null | head -10
    else
        echo -e "${RED}No backups found in ${BACKUP_DIR}${NC}"
        exit 1
    fi
}

# Function to restore from backup
restore_backup() {
    local BACKUP_FILE="$1"
    
    if [ ! -f "$BACKUP_FILE" ]; then
        echo -e "${RED}❌ Backup file not found: ${BACKUP_FILE}${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}⚠️  WARNING: This will replace all data in the database!${NC}"
    echo -e "${YELLOW}Database: ${DB_NAME} on ${DB_HOST}:${DB_PORT}${NC}"
    echo -e "${YELLOW}Backup: ${BACKUP_FILE}${NC}"
    echo ""
    read -p "Are you sure you want to restore? (yes/no): " -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo -e "${RED}Restore cancelled${NC}"
        exit 1
    fi
    
    # Create a safety backup first
    echo -e "${YELLOW}🔒 Creating safety backup before restore...${NC}"
    ./scripts/backup.sh
    
    echo -e "${YELLOW}♻️  Restoring database from backup...${NC}"
    
    # Check if running in Docker or native
    if command -v docker &> /dev/null && docker ps | grep -q infra-db-1; then
        echo -e "${GREEN}📦 Using Docker container for restore${NC}"
        
        # Restore using Docker
        gunzip < "$BACKUP_FILE" | docker exec -i infra-db-1 psql -U ${DB_USER} -d ${DB_NAME}
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Database restored successfully${NC}"
        else
            echo -e "${RED}❌ Restore failed${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}🖥️  Using native PostgreSQL for restore${NC}"
        
        # Restore using native psql
        gunzip < "$BACKUP_FILE" | PGPASSWORD="${DB_PASSWORD}" psql \
            -h ${DB_HOST} \
            -p ${DB_PORT} \
            -U ${DB_USER} \
            -d ${DB_NAME}
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Database restored successfully${NC}"
        else
            echo -e "${RED}❌ Restore failed${NC}"
            exit 1
        fi
    fi
}

# Function to rollback last migration
rollback_migration() {
    echo -e "${YELLOW}🔄 Rolling back last migration...${NC}"
    
    # Get the last applied migration
    cd ..  # Go to packages/db directory
    
    echo -e "${YELLOW}Current migration status:${NC}"
    pnpm prisma migrate status
    
    echo ""
    echo -e "${RED}⚠️  Prisma doesn't support automatic rollback.${NC}"
    echo -e "${YELLOW}To rollback, you need to:${NC}"
    echo "1. Create a new migration that reverses the changes"
    echo "2. OR restore from a backup"
    echo ""
    echo -e "${YELLOW}Creating a rollback migration:${NC}"
    echo "pnpm prisma migrate dev --name rollback_[original_migration_name]"
    echo ""
    echo -e "${YELLOW}Then manually write SQL to reverse the changes in:${NC}"
    echo "prisma/migrations/[timestamp]_rollback_[name]/migration.sql"
}

# Function to reset database (dangerous!)
reset_database() {
    echo -e "${RED}⚠️  DANGER: This will DELETE ALL DATA in the database!${NC}"
    echo -e "${RED}Database: ${DB_NAME} on ${DB_HOST}:${DB_PORT}${NC}"
    echo ""
    read -p "Type 'DELETE ALL DATA' to confirm: " -r
    echo ""
    
    if [[ $REPLY != "DELETE ALL DATA" ]]; then
        echo -e "${GREEN}Reset cancelled - good choice!${NC}"
        exit 0
    fi
    
    # Create a safety backup first
    echo -e "${YELLOW}🔒 Creating safety backup before reset...${NC}"
    ./scripts/backup.sh
    
    echo -e "${RED}🗑️  Resetting database...${NC}"
    
    cd ..  # Go to packages/db directory
    pnpm prisma migrate reset --force --skip-seed
    
    echo -e "${GREEN}✅ Database reset complete${NC}"
    echo -e "${YELLOW}Run 'pnpm db:seed' to add seed data${NC}"
}

# Main menu
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}    Nelo Database Rollback Tool${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "What would you like to do?"
echo ""
echo "1) List available backups"
echo "2) Restore from a backup"
echo "3) Rollback last migration (manual)"
echo "4) Reset database (DANGER!)"
echo "5) Exit"
echo ""
read -p "Enter your choice (1-5): " -r choice

case $choice in
    1)
        list_backups
        ;;
    2)
        list_backups
        echo ""
        read -p "Enter the full path to the backup file: " -r backup_file
        restore_backup "$backup_file"
        ;;
    3)
        rollback_migration
        ;;
    4)
        reset_database
        ;;
    5)
        echo -e "${GREEN}Goodbye!${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${YELLOW}Remember to:${NC}"
echo "• Test the application after any rollback"
echo "• Update your code to match the database state"
echo "• Keep your backups safe"
echo -e "${GREEN}═══════════════════════════════════════${NC}"