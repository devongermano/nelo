import { FastifyReply, FastifyRequest } from 'fastify';

interface Scene { id: string; text: string; version: number }

export function versionMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  done: () => void
) {
  const ifMatch = request.headers['if-match'];
  const scene = (request as any).scene as Scene | undefined;

  if (!ifMatch || typeof ifMatch !== 'string') {
    reply.status(400).send({ error: 'If-Match header required' });
    return;
  }
  if (!scene) {
    reply.status(404).send({ error: 'Scene not found' });
    return;
  }
  if (String(scene.version) !== ifMatch) {
    reply.status(412).send({ error: 'Version mismatch' });
    return;
  }
  done();
}
