# Database Migrations Guide

This document outlines the database migration strategy for the Nelo project, including best practices, commands, and troubleshooting.

## Overview

Nelo uses Prisma as its ORM and migration tool. The database schema is defined in `/packages/db/prisma/schema.prisma` and migrations are managed through Prisma Migrate.

## Migration Strategy

### Development vs. Production

- **Development**: Use migration commands for schema evolution
- **Production**: Always use `prisma migrate deploy` (never `prisma migrate dev`)
- **Prototyping**: `prisma db push` is available but should ONLY be used for quick prototyping

### Key Principles

1. **Never use interactive commands in CI/CD** - Commands like `prisma migrate dev` require interactive confirmation
2. **Always create migrations before deploying** - Schema changes must be captured in migration files
3. **Test migrations on test database first** - Use the test database to validate migrations
4. **Version control all migrations** - Migration files in `/packages/db/prisma/migrations/` must be committed

## Database Setup

### Local Development Database

```bash
# Start Docker infrastructure
cd infra && docker compose up -d

# Apply migrations to development database
pnpm db:migrate:deploy

# Seed the database (optional)
pnpm db:seed
```

### Test Database

```bash
# Create test database
docker exec -it nelo_postgres psql -U nelo -c "CREATE DATABASE nelo_test;"

# Apply migrations to test database
DATABASE_URL="postgresql://nelo:nelo@localhost:5432/nelo_test" pnpm db:migrate:deploy

# Or use the convenience script
cd packages/db && ./scripts/setup-test-db.sh
```

## Migration Commands

All commands should be run from the `/packages/db` directory unless otherwise specified.

### Creating Migrations

```bash
# Create a new migration with changes (interactive - dev only)
pnpm db:migrate:dev --name <migration-name>

# Create migration without applying (for CI/CD)
pnpm db:migrate:create --name <migration-name>

# Generate migration SQL only
pnpm prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datasource prisma/schema.prisma \
  --script > migration.sql
```

### Applying Migrations

```bash
# Apply pending migrations (production-safe)
pnpm db:migrate:deploy

# Check migration status
pnpm db:migrate:status

# Reset database (WARNING: destroys all data)
pnpm db:migrate:reset --force --skip-seed
```

### Non-Interactive Commands for CI/CD

**CRITICAL**: In non-interactive environments (CI/CD, scripts, bots), use these commands:

```bash
# Apply schema changes non-interactively
prisma db push --force-reset --accept-data-loss

# Deploy migrations non-interactively
prisma migrate deploy

# Reset database non-interactively
prisma migrate reset --force --skip-seed
```

## Migration Workflow

### 1. Schema Change Workflow

1. Edit `/packages/db/prisma/schema.prisma`
2. Generate Prisma Client: `pnpm prisma:generate`
3. Create migration: `pnpm db:migrate:create --name descriptive-name`
4. Review migration SQL in `/packages/db/prisma/migrations/`
5. Apply migration: `pnpm db:migrate:deploy`
6. Test the changes
7. Commit schema and migration files

### 2. Baseline Migration (Initial Setup)

For existing databases or first-time setup:

```bash
# Generate baseline migration
prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/20250817000000_baseline/migration.sql

# Mark as applied (if database already has schema)
prisma migrate resolve --applied 20250817000000_baseline
```

### 3. Rollback Procedures

Prisma doesn't have built-in rollback, but you can:

1. **Before applying to production**: Delete the migration folder and regenerate
2. **After applying**: Create a new migration that reverts the changes
3. **Emergency**: Restore from database backup

```bash
# Create a revert migration
pnpm db:migrate:create --name revert_<original-migration-name>
# Manually edit the SQL to reverse the changes
```

## Performance Indexes

The baseline migration includes performance indexes for optimal query performance:

```sql
-- Query performance indexes
CREATE INDEX "scene_project_index" ON "Scene"("projectId", "index");
CREATE INDEX "scene_chapter_order" ON "Scene"("chapterId", "order");
CREATE INDEX "entity_project_type" ON "Entity"("projectId", "type");

-- Text search indexes
CREATE INDEX "scene_content_search" ON "Scene" 
  USING gin(to_tsvector('english', "contentMd"));
```

## Troubleshooting

### Common Issues

#### 1. "Database schema drift" error

**Problem**: Schema in database doesn't match migrations
```bash
# Check status
pnpm db:migrate:status

# Force reset (WARNING: data loss)
pnpm db:migrate:reset --force --skip-seed
```

#### 2. "Migration already applied" error

**Problem**: Trying to apply a migration that's already in database
```bash
# Mark specific migration as applied
prisma migrate resolve --applied <migration-name>
```

#### 3. "Foreign key constraint" errors

**Problem**: Data violates foreign key constraints
- Check data integrity before migration
- May need to migrate data separately
- Consider making foreign keys nullable temporarily

#### 4. pgvector extension missing

**Problem**: Vector extension not installed
```bash
# Install in database
docker exec -it nelo_postgres psql -U nelo -d nelo -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Migration Best Practices

1. **Always backup before major migrations**
   ```bash
   docker exec nelo_postgres pg_dump -U nelo nelo > backup.sql
   ```

2. **Test migrations on test database first**
   ```bash
   DATABASE_URL=$TEST_DATABASE_URL pnpm db:migrate:deploy
   ```

3. **Keep migrations small and focused**
   - One logical change per migration
   - Easier to debug and rollback

4. **Document breaking changes**
   - Add comments in migration files
   - Update this document for complex migrations

5. **Monitor migration performance**
   - Large tables may need batch processing
   - Consider maintenance windows for big changes

## Environment Variables

Configure database connections via environment variables:

```bash
# Development (default)
DATABASE_URL="postgresql://nelo:nelo@localhost:5432/nelo"

# Test
TEST_DATABASE_URL="postgresql://nelo:nelo@localhost:5432/nelo_test"

# Production (example)
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"
```

## Testing Migrations

Run the schema validation tests to ensure migrations are working:

```bash
# Run schema validation tests
cd packages/db
pnpm test src/schema-validation.test.ts
```

## Additional Resources

- [Prisma Migrate Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- Project-specific migration history: `/packages/db/prisma/migrations/`