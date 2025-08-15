import { FastifyInstance } from 'fastify';
import { getSceneById } from './scenes.service';

export default async function scenesController(app: FastifyInstance) {
  app.get('/scenes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const scene = await getSceneById(id);
    if (!scene) {
      return reply.code(404).send({ error: 'Not Found' });
    }
    return scene;
  });
}
