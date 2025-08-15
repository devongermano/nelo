import { FastifyInstance } from 'fastify';
import { composeContext } from '@nelo/context';

export default async function contextController(app: FastifyInstance) {
  app.post('/compose-context', async (request, reply) => {
    const result = await composeContext((request as any).body);
    return result;
  });
}
