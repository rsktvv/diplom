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

@Entity('cameras')
@Index('idx_cameras_project_id', ['projectId'])
export class Camera {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // "номер камеры" — пусть это будет name (Cam 1, Камера у входа и т.п.)
  @Column({ type: 'varchar', length: 100 })
  name!: string;

  // "на что показывает" — location/description
  @Column({ type: 'varchar', length: 255 })
  location!: string;

  // RTSP-поток
  @Column({ type: 'varchar', length: 255 })
  rtspUrl!: string;

  // HLS-поток (формируется у тебя в stream.service)
  @Column({ type: 'varchar', length: 255, nullable: true })
  hlsUrl?: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'uuid' })
  projectId!: string;

  @ManyToOne(() => Project, (project) => project.cameras, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'projectId' })
  project!: Project;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
