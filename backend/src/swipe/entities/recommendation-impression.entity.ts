import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('recommendation_impressions')
export class RecommendationImpression {
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

  @Column({ name: 'request_id' })
  requestId: string;

  @Column({ name: 'rank_position' })
  rankPosition: number;

  @Column({ name: 'model_version', default: 'rule_v1' })
  modelVersion: string;

  @Column({ type: 'float', nullable: true })
  score: number | null;

  @CreateDateColumn({ name: 'shown_at' })
  shownAt: Date;
}
