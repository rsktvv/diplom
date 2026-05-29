import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalendarEvent } from './calendar-event.entity';
import { Project } from '../project/project.entity';
import { User } from '../users/user.entity';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(CalendarEvent)
    private readonly repo: Repository<CalendarEvent>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  findAll() {
    return this.repo.find({ order: { date: 'DESC' } });
  }

  findByProject(projectId: string) {
    return this.repo.find({
      where: { project: { id: projectId } },
      order: { date: 'DESC' },
    });
  }

  findByDate(date: string) {
    return this.repo.find({
      where: { date },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const event = await this.repo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Событие не найдено');
    return event;
  }

  async create(dto: CreateCalendarEventDto) {
    const project = await this.projectRepo.findOne({ where: { id: dto.projectId } });
    if (!project) throw new NotFoundException('Проект не найден');

    const author = await this.userRepo.findOne({ where: { id: dto.authorId } });
    if (!author) throw new NotFoundException('Пользователь не найден');

    const event = this.repo.create({
      project,
      author,
      date: dto.date,
      title: dto.title,
      description: dto.description,
      type: dto.type,
    });

    return this.repo.save(event);
  }

  async update(id: string, dto: UpdateCalendarEventDto) {
    const event = await this.findOne(id);

    if (dto.projectId) {
      const project = await this.projectRepo.findOne({ where: { id: dto.projectId } });
      if (!project) throw new NotFoundException('Проект не найден');
      event.project = project;
    }

    if (dto.authorId) {
      const author = await this.userRepo.findOne({ where: { id: dto.authorId } });
      if (!author) throw new NotFoundException('Пользователь не найден');
      event.author = author;
    }

    if (dto.date !== undefined) event.date = dto.date;
    if (dto.title !== undefined) event.title = dto.title;
    if (dto.description !== undefined) event.description = dto.description;
    if (dto.type !== undefined) event.type = dto.type;

    return this.repo.save(event);
  }

  async remove(id: string) {
    const event = await this.findOne(id);
    return this.repo.remove(event);
  }
}
