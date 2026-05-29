import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { CreateTurnstileAccessLogDto } from './dto/create-turnstile-access-log.dto';
import { TurnstileAccessLog } from './turnstile-access-log.entity';

@Injectable()
export class TurnstileService {
  constructor(
    @InjectRepository(TurnstileAccessLog)
    private readonly repo: Repository<TurnstileAccessLog>,
  ) {}

  create(dto: CreateTurnstileAccessLogDto) {
    const log = this.repo.create({
      ...dto,
      occurredAt: new Date(dto.occurredAt),
    });

    return this.repo.save(log);
  }

  findByMonth(year: number, month: number, projectId?: string) {
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));

    return this.repo.find({
      where: {
        ...(projectId ? { projectId } : {}),
        occurredAt: Between(start, end),
      },
      order: {
        occurredAt: 'ASC',
      },
    });
  }
}
