import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from '../project/project.entity';
import { User } from '../users/user.entity';

@Entity('urgent_tasks')
export class UrgentTask {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Project, { nullable: false, eager: true, onDelete: 'CASCADE' })
  project!: Project;

  @ManyToOne(() => User, { nullable: false, eager: true })
  sender!: User;

  @ManyToOne(() => User, { nullable: false, eager: true })
  recipient!: User;

  @Column({ type: 'text' })
  text!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  photoFileId?: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  completedAt?: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
