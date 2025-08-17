import { fileURLToPath } from 'url'
import { prisma } from './src/index.js'
import { demoProject, secretScene } from './seed-data.js'

export async function seed() {
  const project = await prisma.project.create({
    data: demoProject,
    include: {
      books: {
        include: {
          chapters: true,
        },
      },
    },
  })

  // Create the secret scene with proper projectId
  const chapter = project.books[0].chapters[0]
  const scene = await prisma.scene.create({
    data: {
      ...secretScene,
      chapterId: chapter.id,
      projectId: project.id,
    }
  })

  console.log(`Seeded demo project ${project.id}`)
  console.log(`Seeded secret scene ${scene.id}`)
  return { projectId: project.id, sceneId: scene.id }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
