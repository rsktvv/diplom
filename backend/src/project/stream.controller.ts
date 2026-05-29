import { Controller, Post, Param } from '@nestjs/common';
import { StreamService } from './stream.service';

@Controller('streams')
export class StreamController {
  constructor(private readonly streamService: StreamService) {}

  @Post(':cameraId/start')
  start(@Param('cameraId') cameraId: string) {
    return this.streamService.start(cameraId);
  }

  @Post(':cameraId/stop')
  stop(@Param('cameraId') cameraId: string) {
    return this.streamService.stop(cameraId);
  }
}
