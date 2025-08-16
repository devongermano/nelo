import { IsOptional, IsString } from 'class-validator';

export class UpdateSceneDto {
  @IsString()
  @IsOptional()
  text?: string;
}
