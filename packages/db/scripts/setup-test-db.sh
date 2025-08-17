#!/bin/bash

# Setup script for test database
# This script creates and configures the test database for running tests

set -e  # Exit on error

echo "🔧 Setting up test database..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Database configuration
TEST_DB_NAME="nelo_test"
TEST_DB_USER="nelo"
TEST_DB_PASSWORD="nelo"
TEST_DB_HOST="localhost"
TEST_DB_PORT="5432"

# Set the test database URL
export DATABASE_URL="postgresql://${TEST_DB_USER}:${TEST_DB_PASSWORD}@${TEST_DB_HOST}:${TEST_DB_PORT}/${TEST_DB_NAME}"

echo -e "${YELLOW}📊 Checking if test database exists...${NC}"

# Check if database exists (will exit with non-zero if doesn't exist)
if docker exec -it nelo_postgres psql -U ${TEST_DB_USER} -lqt | cut -d \| -f 1 | grep -qw ${TEST_DB_NAME}; then
    echo -e "${YELLOW}⚠️  Test database exists. Dropping and recreating...${NC}"
    
    # Drop existing database
    docker exec -it nelo_postgres psql -U ${TEST_DB_USER} -c "DROP DATABASE IF EXISTS ${TEST_DB_NAME};"
fi

echo -e "${GREEN}✨ Creating test database...${NC}"
# Create the test database
docker exec -it nelo_postgres psql -U ${TEST_DB_USER} -c "CREATE DATABASE ${TEST_DB_NAME};"

echo -e "${GREEN}🔌 Installing pgvector extension...${NC}"
# Install pgvector extension
docker exec -it nelo_postgres psql -U ${TEST_DB_USER} -d ${TEST_DB_NAME} -c "CREATE EXTENSION IF NOT EXISTS vector;"

echo -e "${GREEN}🚀 Running migrations...${NC}"
# Run migrations on test database
cd "$(dirname "$0")/.."
pnpm prisma migrate deploy

echo -e "${GREEN}✅ Test database setup complete!${NC}"
echo ""
echo "Database URL: ${DATABASE_URL}"
echo ""
echo "You can now run tests with: pnpm test"