export class SceneResponseDto {
  id!: string;
  content!: string | null;
  chapterId!: string;
  projectId!: string;
  order!: number | null;
  version!: number;
  createdAt!: Date;
  updatedAt!: Date;
}