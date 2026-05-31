import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { CameraService } from './camera.service';
import { CreateCameraDto } from './dto/create-camera.dto';
import { UpdateCameraDto } from './dto/update-camera.dto';

@Controller('cameras')
export class CameraController {
  constructor(private readonly cameraService: CameraService) {}

  @Post()
  create(@Body() dto: CreateCameraDto) {
    return this.cameraService.create(dto);
  }

  @Get()
  findAll() {
    return this.cameraService.findAll();
  }

  @Get('by-project/:projectId')
  findByProject(@Param('projectId') projectId: string) {
    return this.cameraService.findByProject(projectId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cameraService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCameraDto) {
    return this.cameraService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cameraService.remove(id);
  }
}
