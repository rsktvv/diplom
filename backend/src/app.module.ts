import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from './users/users.module';
import { TelegramAuthModule } from './telegram-auth/telegram-auth.module';
import { ProjectsModule } from './project/projects.module';
import { CameraModule } from './cameras/camera.module';
import { CalendarModule } from './calendar/calendar.module';
import { TurnstileModule } from './turnstile/turnstile.module';
import { UrgentTasksModule } from './urgent-tasks/urgent-tasks.module';

import { User } from './users/user.entity';
import { Project } from './project/project.entity';
import { Camera } from './cameras/camera.entity';
import { ProjectEvent } from './project/project-event.entity';
import { CalendarEvent } from './calendar/calendar-event.entity';
import { TurnstileAccessLog } from './turnstile/turnstile-access-log.entity';
import { UrgentTask } from './urgent-tasks/urgent-task.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'backend/.env', 'telegram_bot/.env', '../.env', '../telegram_bot/.env'],
    }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'construction_crm',
      entities: [User, Project, Camera, ProjectEvent, CalendarEvent, TurnstileAccessLog, UrgentTask],
      synchronize: true,
      logging: true,
    }),

    UsersModule,
    TelegramAuthModule,
    ProjectsModule,
    CameraModule,
    CalendarModule,
    TurnstileModule,
    UrgentTasksModule,
  ],
})
export class AppModule {}
