import { describe, it, expect } from 'vitest'
import { prisma, reset } from '../src'

describe('db health', () => {
  it('creates a project', async () => {
    await reset()
    const project = await prisma.project.create({ 
      data: { 
        name: 'test', 
        slug: `test-${Date.now()}`,
        version: 1 
      } 
    })
    expect(project.name).toBe('test')
  })
})
