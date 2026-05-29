import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Camera } from './camera.entity';
import { Project } from './project.entity';
import { CameraService } from './camera.service';
import { CameraController } from './camera.controller';
import { StreamService } from './stream.service';
import { StreamController } from './stream.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Camera, Project])],
  providers: [CameraService, StreamService],
  controllers: [CameraController, StreamController],
  exports: [CameraService, StreamService],
})
export class CameraModule {}
