import { FastifyReply, FastifyRequest } from 'fastify';

const keys = new Set<string>();

export function clearIdempotencyKeys() {
  keys.clear();
}

export function idempotencyMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  done: () => void
) {
  const key = request.headers['x-idempotency-key'];
  if (!key || typeof key !== 'string') {
    reply.status(400).send({ error: 'X-Idempotency-Key header required' });
    return;
  }
  if (keys.has(key)) {
    reply.status(409).send({ error: 'Duplicate request' });
    return;
  }
  keys.add(key);
  done();
}
