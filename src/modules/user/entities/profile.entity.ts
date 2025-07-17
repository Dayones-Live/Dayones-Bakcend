import {
  BaseEntity,
  Column,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
} from 'typeorm';
import { IsOptional, Length } from 'class-validator';
import { User } from './user.entity';

@Entity('profile')
export class Profile extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  @IsOptional()
  @Length(0, 500, { message: 'Bio must be less than 500 characters' })
  bio?: string;

  @Column({ nullable: true })
  @IsOptional()
  @Length(0, 1000, { message: 'Description must be less than 1000 characters' })
  description?: string;

  @Column({ nullable: true })
  @IsOptional()
  website?: string;

  @Column({ nullable: true })
  @IsOptional()
  instagram?: string;

  @Column({ nullable: true })
  @IsOptional()
  twitter?: string;

  @Column({ nullable: true })
  @IsOptional()
  facebook?: string;

  @Column({ nullable: true })
  @IsOptional()
  tiktok?: string;

  @Column({ nullable: true })
  @IsOptional()
  youtube?: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;

  @OneToOne(() => User, (user) => user.profile)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: false })
  user_id: string;
} 