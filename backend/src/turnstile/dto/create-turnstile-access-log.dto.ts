import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TurnstileAction } from '../turnstile-access-log.entity';

export class CreateTurnstileAccessLogDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsString()
  cardId: string;

  @IsOptional()
  @IsString()
  personName?: string;

  @IsEnum(TurnstileAction)
  action: TurnstileAction;

  @IsDateString()
  occurredAt: string;

  @IsOptional()
  @IsString()
  deviceName?: string;
}
