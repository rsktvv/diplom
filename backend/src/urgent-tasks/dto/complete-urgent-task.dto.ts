import { IsUUID } from 'class-validator';

export class CompleteUrgentTaskDto {
  @IsUUID()
  recipientId!: string;
}
