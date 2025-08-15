import { describe, it, expect } from 'vitest'
import { prisma, reset } from '../src/index.js'
import { seed } from '../seed.js'
import { demoProject, secretScene } from '../seed-data.js'

describe('seed script', () => {
  it('inserts demo project and secret scene', async () => {
    await reset()
    const { projectId, sceneId } = await seed()
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    const scene = await prisma.scene.findUnique({ where: { id: sceneId } })
    expect(project?.name).toBe(demoProject.name)
    expect(scene?.content).toBe(secretScene.content)
  })
})
