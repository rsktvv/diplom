import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarEvent } from '../calendar/calendar-event.entity';
import { Project } from '../project/project.entity';
import { TurnstileAccessLog } from './turnstile-access-log.entity';
import { TurnstileController } from './turnstile.controller';
import { TurnstileService } from './turnstile.service';

@Module({
  imports: [TypeOrmModule.forFeature([TurnstileAccessLog, Project, CalendarEvent])],
  controllers: [TurnstileController],
  providers: [TurnstileService],
})
export class TurnstileModule {}
