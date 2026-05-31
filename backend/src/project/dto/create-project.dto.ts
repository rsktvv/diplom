import { IsArray, IsNumber, IsString, IsUUID, Min } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  name: string;

  @IsString()
  street: string;

  @IsNumber()
  @Min(0)
  area: number;

  @IsUUID()
  customerId: string;

  @IsUUID()
  foremanId: string;

  @IsArray()
  @IsUUID('4', { each: true })
  workerIds: string[];
}
