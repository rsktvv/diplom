import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { EventType } from '../calendar-event.entity';

export class CreateCalendarEventDto {
  @IsUUID()
  projectId: string;

  @IsUUID()
  authorId: string;

  @IsDateString()
  date: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(EventType)
  type?: EventType;
}