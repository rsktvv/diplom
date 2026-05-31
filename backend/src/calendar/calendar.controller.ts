import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Post()
  create(@Body() dto: CreateCalendarEventDto) {
    return this.calendarService.create(dto);
  }

  @Get()
  findAll() {
    return this.calendarService.findAll();
  }

  @Get('by-project/:projectId')
  findByProject(@Param('projectId') projectId: string, @Query('userId') userId?: string) {
    return this.calendarService.findByProject(projectId, userId);
  }

  @Get('by-date')
  findByDate(@Query('date') date: string) {
    return this.calendarService.findByDate(date);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.calendarService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCalendarEventDto) {
    return this.calendarService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.calendarService.remove(id);
  }
}
