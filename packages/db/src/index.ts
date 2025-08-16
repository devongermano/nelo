import { prisma } from './client'

export async function seed() {
  await prisma.$connect()
}

export async function reset() {
  // Safe reset helper for tests using Prisma methods
  // This approach is much safer than raw SQL and prevents injection attacks
  await prisma.$transaction([
    prisma.embedding.deleteMany(),
    prisma.sceneEntity.deleteMany(),
    prisma.sentence.deleteMany(),
    prisma.snapshot.deleteMany(),
    prisma.editSpan.deleteMany(),
    prisma.hunk.deleteMany(),
    prisma.patch.deleteMany(),
    prisma.refactor.deleteMany(),
    prisma.costEvent.deleteMany(),
    prisma.run.deleteMany(),
    prisma.contextRule.deleteMany(),
    prisma.canonFact.deleteMany(),
    prisma.entity.deleteMany(),
    prisma.scene.deleteMany(),
    prisma.chapter.deleteMany(),
    prisma.book.deleteMany(),
    prisma.providerKey.deleteMany(),
    prisma.budget.deleteMany(),
    prisma.styleGuide.deleteMany(),
    prisma.membership.deleteMany(),
    prisma.user.deleteMany(),
    prisma.project.deleteMany(),
  ])
}

export { prisma }
export { encryptApiKey, decryptApiKey, hashData, verifyHashedData } from './crypto'
