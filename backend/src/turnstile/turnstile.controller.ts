import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CreateTurnstileAccessLogDto } from './dto/create-turnstile-access-log.dto';
import { TurnstileService } from './turnstile.service';

@Controller('turnstile')
export class TurnstileController {
  constructor(private readonly turnstileService: TurnstileService) {}

  @Post('access-logs')
  create(@Body() dto: CreateTurnstileAccessLogDto) {
    return this.turnstileService.create(dto);
  }

  @Get('access-logs/month')
  findByMonth(
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.turnstileService.findByMonth(Number(year), Number(month), projectId);
  }

  @Get('attendance/day')
  findAttendanceByDay(@Query('projectId') projectId: string, @Query('date') date: string) {
    return this.turnstileService.findAttendanceByDay(projectId, date);
  }
}
