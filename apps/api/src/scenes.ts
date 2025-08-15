import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { idempotencyMiddleware } from './middlewares/idempotency.middleware';
import { versionMiddleware } from './middlewares/version.middleware';

interface Scene { id: string; text: string; version: number }
const scenes = new Map<string, Scene>();
let nextId = 1;

function loadScene(request: FastifyRequest, reply: FastifyReply, done: () => void) {
  const id = (request.params as any).id;
  const scene = scenes.get(String(id));
  if (!scene) {
    reply.status(404).send({ error: 'Scene not found' });
    return;
  }
  (request as any).scene = scene;
  done();
}

export async function scenesRoutes(app: FastifyInstance) {
  app.post(
    '/scenes',
    { preHandler: idempotencyMiddleware },
    async (request, reply) => {
      const id = String(nextId++);
      const text = (request.body as any)?.text ?? '';
      const scene: Scene = { id, text, version: 1 };
      scenes.set(id, scene);
      reply.status(201).send(scene);
    }
  );

  app.patch(
    '/scenes/:id',
    { preHandler: [loadScene, versionMiddleware] },
    async (request, reply) => {
      const scene = (request as any).scene as Scene;
      const text = (request.body as any)?.text;
      if (typeof text === 'string') {
        scene.text = text;
      }
      scene.version += 1;
      reply.send(scene);
    }
  );
}

export { scenes, Scene };
