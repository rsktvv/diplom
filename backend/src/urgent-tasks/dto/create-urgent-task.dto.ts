import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateUrgentTaskDto {
  @IsUUID()
  projectId!: string;

  @IsUUID()
  senderId!: string;

  @IsUUID()
  recipientId!: string;

  @IsString()
  text!: string;

  @IsOptional()
  @IsString()
  photoFileId?: string;
}
