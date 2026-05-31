import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCameraDto {
  @IsUUID()
  projectId: string;

  @IsString()
  name: string;

  @IsString()
  location: string;

  @IsString()
  rtspUrl: string;

  @IsOptional()
  @IsString()
  hlsUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
