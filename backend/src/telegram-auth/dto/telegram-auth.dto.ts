import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class TelegramAuthDto {
  @IsNotEmpty()
  id: string | number;

  @IsString()
  first_name: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  photo_url?: string;

  @IsNotEmpty()
  auth_date: string | number;

  @IsString()
  hash: string;
}
