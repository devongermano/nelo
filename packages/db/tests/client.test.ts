import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '../src/client'

beforeAll(async () => {
  await prisma.$connect()
})

afterAll(async () => {
  await prisma.project.deleteMany()
  await prisma.$disconnect()
})

describe('prisma client', () => {
  it('performs a simple query', async () => {
    const project = await prisma.project.create({ data: { name: 'test', version: 1 } })
    const found = await prisma.project.findUnique({ where: { id: project.id } })
    expect(found?.name).toBe('test')
  })
})
