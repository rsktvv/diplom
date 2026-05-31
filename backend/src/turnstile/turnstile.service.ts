import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { CalendarEvent, EventType } from '../calendar/calendar-event.entity';
import { Project } from '../project/project.entity';
import { User } from '../users/user.entity';
import { CreateTurnstileAccessLogDto } from './dto/create-turnstile-access-log.dto';
import { TurnstileAccessLog, TurnstileAction } from './turnstile-access-log.entity';

@Injectable()
export class TurnstileService {
  constructor(
    @InjectRepository(TurnstileAccessLog)
    private readonly repo: Repository<TurnstileAccessLog>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(CalendarEvent)
    private readonly calendarRepo: Repository<CalendarEvent>,
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

  async findAttendanceByDay(projectId: string, date: string) {
    const workEventCount = await this.calendarRepo.count({
      where: {
        project: { id: projectId },
        date,
        type: EventType.WORK,
      },
    });

    if (workEventCount === 0) return [];

    const project = await this.projectRepo
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.foreman', 'foreman')
      .leftJoinAndSelect('project.workers', 'workers')
      .where('project.id = :projectId', { projectId })
      .getOne();

    if (!project) return [];

    const start = new Date(`${date}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const logs = await this.repo.find({
      where: {
        projectId,
        occurredAt: Between(start, end),
      },
      order: { occurredAt: 'ASC' },
    });

    return this.expectedPeople(project).map((person) => {
      const personLogs = logs.filter((log) => this.isLogForUser(log, person.user));
      const entries = personLogs.filter((log) => log.action === TurnstileAction.ENTRY);
      const exits = personLogs.filter((log) => log.action === TurnstileAction.EXIT);

      return {
        user: person.user,
        role: person.role,
        enteredAt: entries[0]?.occurredAt ?? null,
        exitedAt: exits[exits.length - 1]?.occurredAt ?? null,
      };
    });
  }

  private expectedPeople(project: Project) {
    const people: Array<{ user: User; role: 'foreman' | 'worker' }> = [];
    const seen = new Set<string>();

    if (project.foreman) {
      people.push({ user: project.foreman, role: 'foreman' });
      seen.add(project.foreman.id);
    }

    for (const worker of project.workers ?? []) {
      if (seen.has(worker.id)) continue;
      people.push({ user: worker, role: 'worker' });
      seen.add(worker.id);
    }

    return people;
  }

  private isLogForUser(log: TurnstileAccessLog, user: User) {
    const personName = this.normalize(log.personName);
    const fullName = this.normalize([user.firstName, user.lastName].filter(Boolean).join(' '));
    const firstName = this.normalize(user.firstName);

    return (
      Boolean(personName && (personName === fullName || personName === firstName)) ||
      log.cardId === user.telegramId
    );
  }

  private normalize(value?: string) {
    return value?.trim().replace(/\s+/g, ' ').toLowerCase();
  }
}
