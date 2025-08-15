import Fastify from 'fastify';
import projectsController from './projects.controller';
import scenesController from './scenes.controller';

const app = Fastify();

app.get('/health', async () => ({ ok: true }));

app.register(projectsController);
app.register(scenesController);

app.listen({ port: 3001 }, (err, address) => {
  if (err) throw err;
  console.log(`API listening on ${address}`);
});
