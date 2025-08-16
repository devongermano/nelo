import { IsString, IsUUID } from 'class-validator';

export class CreateSceneDto {
  @IsString()
  content!: string;

  @IsUUID()
  chapterId!: string;

  @IsUUID()
  projectId!: string;
}
