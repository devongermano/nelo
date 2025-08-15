# Local Infrastructure

Start the supporting services:

```bash
docker compose up -d
pnpm db:migrate
pnpm db:seed
```
