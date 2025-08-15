import { FastifyInstance } from 'fastify';
import { composeContext as defaultComposeContext } from '@nelo/context';

interface ContextControllerOptions {
  composeContext?: typeof defaultComposeContext;
}

export default async function contextController(
  app: FastifyInstance,
  { composeContext = defaultComposeContext }: ContextControllerOptions = {}
) {
  app.post('/compose-context', async () => composeContext());
}
