import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum SwipeAction {
  LIKE = 'LIKE',
  PASS = 'PASS',
}

@Entity('swipe_events')
@Unique(['viewerUserId', 'candidateUserId'])
export class SwipeEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'viewer_user_id' })
  viewerUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'viewer_user_id' })
  viewer: User;

  @Column({ name: 'candidate_user_id' })
  candidateUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'candidate_user_id' })
  candidate: User;

  @Column({ type: 'enum', enum: SwipeAction })
  action: SwipeAction;

  @Column({ name: 'impression_id', nullable: true })
  impressionId: string | null;

  @Column({ name: 'session_id', nullable: true })
  sessionId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
