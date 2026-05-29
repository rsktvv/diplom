export enum ProjectEventStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
  CANCELED = 'canceled',
}
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { Project } from './project.entity';

@Entity('project_events')
@Index('idx_project_events_project_id', ['projectId'])
@Index('idx_project_events_date', ['date'])
@Index('idx_project_events_status', ['status'])
export class ProjectEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  projectId!: string;

  @ManyToOne(() => Project, (project) => project.events, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'projectId' })
  project!: Project;

  // где что нужно сделать (краткий заголовок)
  @Column({ type: 'varchar', length: 255 })
  title!: string;

  // подробное описание работ
  @Column({ type: 'text', nullable: true })
  description?: string;

  // в какой день (если нужен диапазон, можно сделать startAt / endAt)
  @Column({ type: 'date' })
  date!: string; // либо Date, если хочешь хранить с временем

  // статус выполнения работ
  @Column({
    type: 'enum',
    enum: ProjectEventStatus,
    default: ProjectEventStatus.PLANNED,
  })
  status!: ProjectEventStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
