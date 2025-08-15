import type { Prisma } from '@prisma/client'

export const secretScene: Prisma.SceneCreateWithoutChapterInput = {
  order: 1,
  content: 'The cake is a lie.',
}

export const demoProject: Prisma.ProjectCreateInput = {
  name: 'Demo Project',
  books: {
    create: [
      {
        title: 'Demo Book',
        chapters: {
          create: [
            {
              title: 'Demo Chapter',
              scenes: {
                create: [secretScene],
              },
            },
          ],
        },
      },
    ],
  },
}
