import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Project } from './project.entity';
import { Camera } from '../cameras/camera.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly repo: Repository<Project>,
    @InjectRepository(Camera)
    private readonly cameraRepo: Repository<Camera>,
    private readonly usersService: UsersService,
  ) {}

  private async withCameraCounts<T extends Project>(projects: T[]) {
    if (projects.length === 0) return projects;

    const counts = await this.cameraRepo
      .createQueryBuilder('camera')
      .select('camera.projectId', 'projectId')
      .addSelect('COUNT(camera.id)', 'count')
      .where('camera.projectId IN (:...projectIds)', {
        projectIds: projects.map((project) => project.id),
      })
      .groupBy('camera.projectId')
      .getRawMany<{ projectId: string; count: string }>();

    const countsByProjectId = new Map(
      counts.map((item) => [item.projectId, Number(item.count)]),
    );

    return projects.map((project) =>
      Object.assign(project, {
        cameraCount: countsByProjectId.get(project.id) ?? 0,
      }),
    );
  }

  async findAll() {
    const projects = await this.repo
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.customer', 'customer')
      .leftJoinAndSelect('project.foreman', 'foreman')
      .leftJoinAndSelect('project.workers', 'workers')
      .orderBy('project.createdAt', 'DESC')
      .getMany();

    return this.withCameraCounts(projects);
  }

  async findAvailableForUser(userId: string) {
    const user = await this.usersService.findOne(userId);

    if (user.role === 'admin') {
      return this.findAll();
    }

    const projects = await this.repo
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.customer', 'customer')
      .leftJoinAndSelect('project.foreman', 'foreman')
      .leftJoinAndSelect('project.workers', 'workers')
      .where('customer.id = :userId', { userId })
      .orWhere('foreman.id = :userId', { userId })
      .orWhere('workers.id = :userId', { userId })
      .orderBy('project.createdAt', 'DESC')
      .getMany();

    return this.withCameraCounts(projects);
  }

  async findOne(id: string) {
    const project = await this.repo
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.customer', 'customer')
      .leftJoinAndSelect('project.foreman', 'foreman')
      .leftJoinAndSelect('project.workers', 'workers')
      .where('project.id = :id', { id })
      .getOne();
    if (!project) throw new NotFoundException('Проект не найден');
    const [projectWithCount] = await this.withCameraCounts([project]);
    return projectWithCount;
  }

  async create(dto: CreateProjectDto) {
    const customer = await this.usersService.findOne(dto.customerId);
    const foreman = await this.usersService.findOne(dto.foremanId);

    const workers = dto.workerIds?.length
      ? await this.usersService['repo'].findBy({ id: In(dto.workerIds) })
      : [];

    const project = this.repo.create({
      name: dto.name,
      street: dto.street,
      area: dto.area,
      customer,
      foreman,
      workers,
    });

    return this.repo.save(project);
  }

  async update(id: string, dto: UpdateProjectDto) {
    const project = await this.findOne(id);

    if (dto.customerId) {
      project.customer = await this.usersService.findOne(dto.customerId);
    }

    if (dto.foremanId) {
      project.foreman = await this.usersService.findOne(dto.foremanId);
    }

    if (dto.workerIds) {
      project.workers = dto.workerIds.length
        ? await this.usersService['repo'].findBy({ id: In(dto.workerIds) })
        : [];
    }

    if (dto.name !== undefined) project.name = dto.name;
    if (dto.street !== undefined) project.street = dto.street;
    if (dto.area !== undefined) project.area = dto.area;

    return this.repo.save(project);
  }

  async remove(id: string) {
    const project = await this.findOne(id);
    return this.repo.remove(project);
  }
}
