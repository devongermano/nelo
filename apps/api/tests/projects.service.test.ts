import { describe, it, expect, beforeEach } from 'vitest';
import { prisma, reset } from '@nelo/db';
import { ProjectsService } from '../src/projects/projects.service';

beforeEach(async () => {
  await reset();
});

describe('projects.service', () => {
  it('returns all projects', async () => {
    await prisma.project.create({ data: { name: 'proj', version: 1 } });
    const service = new ProjectsService();
    const projects = await service.getAllProjects();
    expect(projects.length).toBe(1);
    expect(projects[0].name).toBe('proj');
  });
});
