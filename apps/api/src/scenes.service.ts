import { prisma } from '@nelo/db';

export async function getSceneById(id: string) {
  return prisma.scene.findUnique({ where: { id } });
}
