import { IsOptional, IsString, IsInt, Min } from 'class-validator';

export class UpdateSceneDto {
  @IsString()
  @IsOptional()
  content?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;
}
