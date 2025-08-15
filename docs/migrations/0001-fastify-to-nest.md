# Migration 0001: Fastify to Nest

## Scope
Replace the Fastify server in [`apps/api/src/index.ts`](../../apps/api/src/index.ts) with a NestJS application.

```ts
// apps/api/src/index.ts
import Fastify from 'fastify';

const app = Fastify();

app.get('/health', async () => ({ ok: true }));

app.listen({ port: 3001 }, (err, address) => {
  if (err) throw err;
  console.log(`API listening on ${address}`);
});
```

## Plan
1. Scaffold a NestJS project under `apps/api`.
2. Recreate the `/health` endpoint using a Nest controller.
3. Configure Nest to listen on the same port and log startup.
4. Remove the Fastify setup once feature parity is achieved.
