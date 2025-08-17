import { tags } from 'typia';

export interface UpdateSceneDto {
  contentMd?: string;
  order?: number & tags.Type<"uint32"> & tags.Minimum<0>;
}
