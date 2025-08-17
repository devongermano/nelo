import { tags } from 'typia';

export interface CreateSceneDto {
  contentMd: string;
  chapterId: string & tags.Format<"uuid">;
  projectId: string & tags.Format<"uuid">;
}
