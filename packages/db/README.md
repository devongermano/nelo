# @nelo/db

Database package for Nelo - Prisma ORM with PostgreSQL.

## Quick Start

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm prisma:generate

# Run migrations
pnpm db:migrate

# Seed database
pnpm db:seed
```

## Testing

```bash
# Run all database tests
pnpm test

# Run specific test file
pnpm vitest <test-file>
```

## Scripts

- `backup.sh` - Backup database with compression
- `rollback.sh` - Interactive migration rollback
- `data-migration.sql` - Field rename migrations

## Documentation

See [/docs/database-migrations.md](/docs/database-migrations.md) for detailed migration guide.