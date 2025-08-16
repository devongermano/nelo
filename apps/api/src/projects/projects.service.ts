import { Injectable } from '@nestjs/common';
import { prisma } from '@nelo/db';

@Injectable()
export class ProjectsService {
  getAllProjects() {
    return prisma.project.findMany();
  }
}
