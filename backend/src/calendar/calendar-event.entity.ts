import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Project } from '../project/project.entity';

export enum EventType {
  WORK = 'work',
  PROBLEM = 'problem',
  DELIVERY = 'delivery',
  OTHER = 'other',
}

@Entity('calendar_events')
export class CalendarEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Project, { nullable: false, eager: true, onDelete: 'CASCADE' })
  project!: Project;

  @ManyToOne(() => User, { nullable: false, eager: true })
  author!: User;

  @Column({ type: 'date' })
  date!: string;

  @Column()
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: EventType, default: EventType.OTHER })
  type!: EventType;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}