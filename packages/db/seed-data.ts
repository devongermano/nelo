import type { Prisma } from '@prisma/client'

export const secretScene: Prisma.SceneCreateWithoutChapterInput = {
  index: 0,
  contentMd: 'The cake is a lie.',
  projectId: '', // Will be set during creation
}

export const demoProject: Prisma.ProjectCreateInput = {
  name: 'Demo Project',
  slug: 'demo-project',
  books: {
    create: [
      {
        title: 'Demo Book',
        chapters: {
          create: [
            {
              title: 'Demo Chapter',
              index: 0,
              // Scenes will be created separately due to projectId requirement
            },
          ],
        },
      },
    ],
  },
}
