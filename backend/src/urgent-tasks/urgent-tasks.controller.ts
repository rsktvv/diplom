import { Body, Controller, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CompleteUrgentTaskDto } from './dto/complete-urgent-task.dto';
import { CreateUrgentTaskDto } from './dto/create-urgent-task.dto';
import { UrgentTasksService } from './urgent-tasks.service';

@Controller('urgent-tasks')
export class UrgentTasksController {
  constructor(private readonly urgentTasksService: UrgentTasksService) {}

  @Get('by-project/:projectId')
  findByProject(@Param('projectId') projectId: string, @Query('userId') userId: string) {
    return this.urgentTasksService.findByProject(projectId, userId);
  }

  @Post()
  create(@Body() dto: CreateUrgentTaskDto) {
    return this.urgentTasksService.create(dto);
  }

  @Get('photo/:id')
  async photoBySimplePath(
    @Param('id') id: string,
    @Query('userId') userId: string,
    @Res() res: Response,
  ) {
    return this.sendPhoto(id, userId, res);
  }

  @Get(':id/photo')
  async photo(
    @Param('id') id: string,
    @Query('userId') userId: string,
    @Res() res: Response,
  ) {
    return this.sendPhoto(id, userId, res);
  }

  private async sendPhoto(id: string, userId: string, res: Response) {
    const photoUrl = await this.urgentTasksService.getTelegramPhotoUrl(id, userId);
    const photoResponse = await fetch(photoUrl);

    if (!photoResponse.ok) {
      res.status(photoResponse.status).send('Не удалось загрузить фото');
      return;
    }

    const contentType = photoResponse.headers.get('content-type') ?? 'image/jpeg';
    const buffer = Buffer.from(await photoResponse.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(buffer);
  }

  @Put(':id/complete')
  complete(@Param('id') id: string, @Body() dto: CompleteUrgentTaskDto) {
    return this.urgentTasksService.complete(id, dto.recipientId);
  }
}
