import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../project/project.entity';
import { User, UserRole } from '../users/user.entity';
import { CreateUrgentTaskDto } from './dto/create-urgent-task.dto';
import { UrgentTask } from './urgent-task.entity';

@Injectable()
export class UrgentTasksService {
  constructor(
    @InjectRepository(UrgentTask)
    private readonly repo: Repository<UrgentTask>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findByProject(projectId: string, requesterId: string) {
    const requester = await this.userRepo.findOne({ where: { id: requesterId } });
    if (!requester) throw new NotFoundException('Пользователь не найден');

    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Проект не найден');

    const canView =
      requester.role === UserRole.ADMIN || project.foreman?.id === requester.id;

    if (!canView) {
      throw new ForbiddenException('Срочные задания доступны только администратору и бригадиру проекта');
    }

    return this.repo.find({
      where: { project: { id: projectId } },
      order: { createdAt: 'DESC' },
    });
  }

  async findViewableTask(id: string, requesterId: string) {
    const requester = await this.userRepo.findOne({ where: { id: requesterId } });
    if (!requester) throw new NotFoundException('Пользователь не найден');

    const task = await this.repo.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Срочное задание не найдено');

    const canView =
      requester.role === UserRole.ADMIN || task.project.foreman?.id === requester.id;

    if (!canView) {
      throw new ForbiddenException('Срочные задания доступны только администратору и бригадиру проекта');
    }

    return task;
  }

  async getTelegramPhotoUrl(id: string, requesterId: string) {
    const task = await this.findViewableTask(id, requesterId);
    if (!task.photoFileId) throw new NotFoundException('Фото не прикреплено');

    const token = process.env.BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new NotFoundException('Токен Telegram-бота не настроен');

    const response = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(task.photoFileId)}`,
    );
    if (!response.ok) throw new NotFoundException('Не удалось получить фото из Telegram');

    const data = (await response.json()) as {
      ok?: boolean;
      result?: {
        file_path?: string;
      };
    };

    const filePath = data.result?.file_path;
    if (!data.ok || !filePath) throw new NotFoundException('Фото не найдено в Telegram');

    return `https://api.telegram.org/file/bot${token}/${filePath}`;
  }

  async create(dto: CreateUrgentTaskDto) {
    const project = await this.projectRepo.findOne({ where: { id: dto.projectId } });
    if (!project) throw new NotFoundException('Проект не найден');

    const sender = await this.userRepo.findOne({ where: { id: dto.senderId } });
    if (!sender) throw new NotFoundException('Отправитель не найден');

    const recipient = await this.userRepo.findOne({ where: { id: dto.recipientId } });
    if (!recipient) throw new NotFoundException('Получатель не найден');

    const task = this.repo.create({
      project,
      sender,
      recipient,
      text: dto.text,
      photoFileId: dto.photoFileId,
    });

    return this.repo.save(task);
  }

  async complete(id: string, recipientId: string) {
    const task = await this.repo.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Срочное задание не найдено');

    if (task.recipient.id !== recipientId) {
      throw new ForbiddenException('Отметить выполнение может только получатель задания');
    }

    if (!task.completedAt) {
      task.completedAt = new Date();
      await this.repo.save(task);
    }

    return task;
  }
}
