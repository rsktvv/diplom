import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Пользователь не найден');
    return user;
  }

  async findByTelegramId(telegramId: string) {
    return this.repo.findOne({ where: { telegramId } });
  }

  async findByTelegramUsername(username: string) {
    const normalized = username.replace(/^@/, '');
    const user = await this.repo.findOne({ where: { telegramUsername: normalized } });
    if (!user) throw new NotFoundException('Пользователь Telegram не найден');
    return user;
  }

  async create(dto: CreateUserDto) {
    const user = this.repo.create(dto as any);
    return this.repo.save(user);
  }

  async upsertTelegramUser(data: Partial<User>) {
    const telegramId = String(data.telegramId);
    const existing = await this.findByTelegramId(telegramId);

    if (existing) {
      Object.assign(existing, {
        ...data,
        role: data.role ?? existing.role,
      });
      return this.repo.save(existing);
    }

    return this.repo.save(this.repo.create(data as any));
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.findOne(id);
    Object.assign(user, dto);
    return this.repo.save(user);
  }

  async remove(id: string) {
    const user = await this.findOne(id);
    return this.repo.remove(user);
  }
}
