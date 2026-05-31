import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Camera } from './camera.entity';
import { Project } from '../project/project.entity';
import { CreateCameraDto } from './dto/create-camera.dto';
import { UpdateCameraDto } from './dto/update-camera.dto';

@Injectable()
export class CameraService {
  constructor(
    @InjectRepository(Camera)
    private readonly cameraRepo: Repository<Camera>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  findAll() {
    return this.cameraRepo.find({ order: { createdAt: 'DESC' } });
  }

  findByProject(projectId: string) {
    return this.cameraRepo.find({
      where: { projectId },
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(id: string) {
    const camera = await this.cameraRepo.findOne({ where: { id } });
    if (!camera) throw new NotFoundException('Камера не найдена');
    return camera;
  }

  async create(dto: CreateCameraDto) {
    const project = await this.projectRepo.findOne({ where: { id: dto.projectId } });
    if (!project) throw new NotFoundException('Проект не найден');

    const camera = this.cameraRepo.create({
      project,
      name: dto.name,
      location: dto.location,
      rtspUrl: dto.rtspUrl,
      hlsUrl: dto.hlsUrl,
      isActive: dto.isActive ?? true,
    });

    return this.cameraRepo.save(camera);
  }

  async update(id: string, dto: UpdateCameraDto) {
    const camera = await this.findOne(id);

    if (dto.projectId) {
      const project = await this.projectRepo.findOne({ where: { id: dto.projectId } });
      if (!project) throw new NotFoundException('Проект не найден');
      camera.project = project;
    }

    if (dto.name !== undefined) camera.name = dto.name;
    if (dto.location !== undefined) camera.location = dto.location;
    if (dto.rtspUrl !== undefined) camera.rtspUrl = dto.rtspUrl;
    if (dto.hlsUrl !== undefined) camera.hlsUrl = dto.hlsUrl;
    if (dto.isActive !== undefined) camera.isActive = dto.isActive;

    return this.cameraRepo.save(camera);
  }

  async remove(id: string) {
    const camera = await this.findOne(id);
    return this.cameraRepo.remove(camera);
  }
}
