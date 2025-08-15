import Fastify from 'fastify';
import { composeContext } from '@nelo/context';
import contextController from './context/context.controller';

const app = Fastify();

app.get('/health', async () => ({ ok: true }));

app.register(contextController, { composeContext });

app.listen({ port: 3001 }, (err, address) => {
  if (err) throw err;
  console.log(`API listening on ${address}`);
});
