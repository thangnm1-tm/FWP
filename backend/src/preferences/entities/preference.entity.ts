import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum GpaPreference {
  SAME_TIER = 'same_tier',
  MAX_1_DIFF = 'max_1_diff',
  NO_PREFERENCE = 'no_preference',
}

@Entity('preferences')
export class Preference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'gender_preference', nullable: true })
  genderPreference: string | null; // 'male', 'female', 'all'

  @Column({ name: 'min_age', default: 18 })
  minAge: number;

  @Column({ name: 'max_age', default: 30 })
  maxAge: number;

  @Column({ name: 'max_distance_km', default: 20 })
  maxDistanceKm: number;

  @Column({
    name: 'gpa_preference',
    type: 'enum',
    enum: GpaPreference,
    default: GpaPreference.NO_PREFERENCE,
  })
  gpaPreference: GpaPreference;

  @Column({ name: 'max_gpa_tier_diff', default: 1 })
  maxGpaTierDiff: number;

  @Column({ name: 'same_university_only', default: false })
  sameUniversityOnly: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
