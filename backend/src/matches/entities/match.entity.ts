import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('matches')
export class Match {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_a_id' })
  userAId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_a_id' })
  userA: User;

  @Column({ name: 'user_b_id' })
  userBId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_b_id' })
  userB: User;

  @CreateDateColumn({ name: 'matched_at' })
  matchedAt: Date;

  @Column({ default: true })
  active: boolean;
}
