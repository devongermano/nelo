import { tags } from 'typia';

export interface UpdateSceneDto {
  content?: string;
  order?: number & tags.Type<"uint32"> & tags.Minimum<0>;
}
