import { FastifyInstance } from 'fastify';
import { getAllProjects } from './projects.service';

export default async function projectsController(app: FastifyInstance) {
  app.get('/projects', async () => {
    return getAllProjects();
  });
}
