import { prisma } from './client'

export async function seed() {
  await prisma.$connect()
}

export async function reset() {
  // Safe reset helper for tests using Prisma methods
  // This approach is much safer than raw SQL and prevents injection attacks
  await prisma.$transaction([
    // Delete in order of dependencies
    prisma.embedding.deleteMany(),
    prisma.sceneEntity.deleteMany(),
    prisma.collabSession.deleteMany(),
    prisma.suggestion.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.sentence.deleteMany(),
    prisma.snapshot.deleteMany(),
    prisma.editSpan.deleteMany(),
    prisma.hunk.deleteMany(),
    prisma.patch.deleteMany(),
    prisma.refactor.deleteMany(),
    prisma.costEvent.deleteMany(),
    prisma.run.deleteMany(),
    prisma.scene.deleteMany(),
    prisma.chapter.deleteMany(),
    prisma.book.deleteMany(),
    prisma.contextRule.deleteMany(),
    prisma.modelProfile.deleteMany(),
    prisma.persona.deleteMany(),
    prisma.promptPreset.deleteMany(),
    prisma.canonFact.deleteMany(),
    prisma.entity.deleteMany(),
    prisma.providerKey.deleteMany(),
    prisma.budget.deleteMany(),
    prisma.styleGuide.deleteMany(),
    prisma.projectMember.deleteMany(),
    prisma.project.deleteMany(),
    prisma.membership.deleteMany(),
    prisma.team.deleteMany(),
    prisma.user.deleteMany(),
  ])
}

// Export the prisma client instance
export { prisma }

// Export all Prisma types and models
export * from '@prisma/client'
export type { Prisma } from '@prisma/client'

// Export custom types
export * from './types'

// Export utility functions
export { encryptApiKey, decryptApiKey, hashData, verifyHashedData } from './crypto'
