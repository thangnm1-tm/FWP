import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { University } from './university.entity';
import { Faculty } from './faculty.entity';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export enum Purpose {
  DATING = 'dating',
  FRIENDSHIP = 'friendship',
  STUDY_BUDDY = 'study_buddy',
  ALL = 'all',
}

/**
 * GPA Bucket mapping:
 * 3 = Giỏi (>= 3.6)
 * 2 = Khá (3.2 - 3.59)
 * 1 = TB Khá (2.5 - 3.19)
 * 0 = TB (< 2.5)
 */
export function gpaToBucket(gpa: number): number {
  if (gpa >= 3.6) return 3;
  if (gpa >= 3.2) return 2;
  if (gpa >= 2.5) return 1;
  return 0;
}

@Entity('profiles')
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'display_name', type: 'varchar', nullable: true })
  displayName: string | null;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: Date | null;

  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender: Gender | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'jsonb', default: [] })
  photos: string[];

  @Column({ type: 'float', nullable: true })
  gpa: number | null;

  @Column({ name: 'gpa_bucket', type: 'int', nullable: true })
  gpaBucket: number | null;

  @Column({ name: 'university_id', type: 'uuid', nullable: true })
  universityId: string | null;

  @ManyToOne(() => University, { nullable: true })
  @JoinColumn({ name: 'university_id' })
  university: University | null;

  @Column({ name: 'faculty_id', type: 'uuid', nullable: true })
  facultyId: string | null;

  @ManyToOne(() => Faculty, { nullable: true })
  @JoinColumn({ name: 'faculty_id' })
  faculty: Faculty | null;

  @Column({ name: 'academic_year', type: 'int', nullable: true })
  academicYear: number | null;

  @Column({ type: 'enum', enum: Purpose, nullable: true })
  purpose: Purpose | null;

  @Column({ name: 'profile_completed', default: false })
  profileCompleted: boolean;

  @Column({ name: 'gpa_visible', default: true })
  gpaVisible: boolean;

  // Discovery is opt-in so existing and newly registered users stay private.
  @Column({ name: 'discoverable', default: false })
  discoverable: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
