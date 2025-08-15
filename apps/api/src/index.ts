import Fastify from 'fastify';

const app = Fastify();

app.get('/health', async () => ({ ok: true }));

app.listen({ port: 3001 }, (err, address) => {
  if (err) throw err;
  console.log(`API listening on ${address}`);
});
