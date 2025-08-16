import { tags } from 'typia';

export interface CreateSceneDto {
  content: string;
  chapterId: string & tags.Format<"uuid">;
  projectId: string & tags.Format<"uuid">;
}
