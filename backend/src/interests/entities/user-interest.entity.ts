import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Interest } from './interest.entity';

@Entity('user_interests')
@Unique(['userId', 'interestId'])
export class UserInterest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'interest_id' })
  interestId: string;

  @ManyToOne(() => Interest)
  @JoinColumn({ name: 'interest_id' })
  interest: Interest;
}
