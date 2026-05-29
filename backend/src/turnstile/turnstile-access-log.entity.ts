import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Project } from '../project/project.entity';

export enum TurnstileAction {
  ENTRY = 'entry',
  EXIT = 'exit',
}

@Entity('turnstile_access_logs')
@Index('idx_turnstile_access_logs_occurred_at', ['occurredAt'])
@Index('idx_turnstile_access_logs_card_id', ['cardId'])
@Index('idx_turnstile_access_logs_project_id', ['projectId'])
export class TurnstileAccessLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  projectId?: string;

  @ManyToOne(() => Project, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'projectId' })
  project?: Project;

  @Column({ type: 'varchar', length: 100 })
  cardId!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  personName?: string;

  @Column({ type: 'enum', enum: TurnstileAction })
  action!: TurnstileAction;

  @Column({ type: 'timestamp with time zone' })
  occurredAt!: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  deviceName?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;
}
