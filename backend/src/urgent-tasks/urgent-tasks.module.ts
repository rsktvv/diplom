import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../project/project.entity';
import { User } from '../users/user.entity';
import { UrgentTask } from './urgent-task.entity';
import { UrgentTasksController } from './urgent-tasks.controller';
import { UrgentTasksService } from './urgent-tasks.service';

@Module({
  imports: [TypeOrmModule.forFeature([UrgentTask, Project, User])],
  controllers: [UrgentTasksController],
  providers: [UrgentTasksService],
})
export class UrgentTasksModule {}
