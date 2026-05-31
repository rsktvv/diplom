import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  OneToMany,
  JoinTable,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Camera } from '../cameras/camera.entity';
import { ProjectEvent } from './project-event.entity';

export enum ProjectStatus {
  NEW = 'new',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
  ARCHIVED = 'archived',
}

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255 })
  street!: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  area!: number;

  @Column({ type: 'enum', enum: ProjectStatus, default: ProjectStatus.NEW })
  status!: ProjectStatus;

  @ManyToOne(() => User, { nullable: false, eager: true })
  customer!: User;

  @ManyToOne(() => User, { nullable: false, eager: true })
  foreman!: User;

  @ManyToMany(() => User, { eager: true })
  @JoinTable({
    name: 'project_workers',
  })
  workers!: User[];

  @OneToMany(() => Camera, (camera) => camera.project, { cascade: false })
  cameras!: Camera[];

  @OneToMany(() => ProjectEvent, (event) => event.project, { cascade: false })
  events!: ProjectEvent[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
