import { Controller } from '@nestjs/common';
import { TypedRoute } from '@nestia/core';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @TypedRoute.Get()
  getAll() {
    return this.projectsService.getAllProjects();
  }
}
