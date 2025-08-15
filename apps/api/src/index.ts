import Fastify from 'fastify';
import { composeContext } from '@nelo/context';
import contextController from './context/context.controller';
import { scenesRoutes } from './scenes';

export function buildApp() {
  const app = Fastify();
  app.get('/health', async () => ({ ok: true }));
  app.register(scenesRoutes);
  app.register(contextController, { composeContext });
  return app;
}

if (require.main === module) {
  const app = buildApp();
  app.listen({ port: 3001 }, (err, address) => {
    if (err) throw err;
    console.log(`API listening on ${address}`);
  });
}
