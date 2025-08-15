import { prisma } from '@nelo/db';

export async function getAllProjects() {
  return prisma.project.findMany();
}
