import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { Camera } from './camera.entity';

@Injectable()
export class StreamService {
  private processes = new Map<string, ChildProcessWithoutNullStreams>();

  constructor(
    @InjectRepository(Camera)
    private readonly cameraRepo: Repository<Camera>,
  ) {}

  async start(cameraId: string) {
    const camera = await this.cameraRepo.findOne({ where: { id: cameraId } });
    if (!camera) throw new NotFoundException('Камера не найдена');

    if (this.processes.has(cameraId)) {
      return {
        message: 'Поток уже запущен',
        hlsUrl: camera.hlsUrl,
      };
    }

    const streamsDir = join(process.cwd(), 'streams', cameraId);
    if (!existsSync(streamsDir)) {
      mkdirSync(streamsDir, { recursive: true });
    }

    const hlsPath = join(streamsDir, 'index.m3u8');

    const args = [
      '-i',
      camera.rtspUrl,
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-f',
      'hls',
      '-hls_time',
      '2',
      '-hls_list_size',
      '3',
      '-hls_flags',
      'delete_segments+append_list',
      hlsPath,
    ];

    const ffmpeg = spawn('ffmpeg', args);

    ffmpeg.stderr.on('data', () => {});
    ffmpeg.on('close', () => {
      this.processes.delete(cameraId);
    });

    this.processes.set(cameraId, ffmpeg);

    camera.hlsUrl = `/streams/${cameraId}/index.m3u8`;
    await this.cameraRepo.save(camera);

    return {
      message: 'Поток запущен',
      hlsUrl: camera.hlsUrl,
    };
  }

  async stop(cameraId: string) {
    const proc = this.processes.get(cameraId);
    if (!proc) {
      return { message: 'Поток не был запущен' };
    }

    proc.kill('SIGTERM');
    this.processes.delete(cameraId);

    return { message: 'Поток остановлен' };
  }
}
