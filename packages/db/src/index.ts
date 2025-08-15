import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()

export async function seed() {
  await prisma.$connect()
}

export async function reset() {
  // basic reset helper for tests
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Project" RESTART IDENTITY CASCADE;')
}
