import {
  BaseEntity,
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
} from 'typeorm';
import { IsNotEmpty, IsOptional, Length } from 'class-validator';
import { User } from './user.entity';

@Entity('profile_gallery')
export class ProfileGallery extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  @IsNotEmpty({ message: 'Image URL is required' })
  image_url: string;

  @Column({ nullable: true })
  @IsOptional()
  @Length(0, 200, { message: 'Caption must be less than 200 characters' })
  caption?: string;

  @Column({ nullable: true })
  @IsOptional()
  @Length(0, 100, { message: 'Alt text must be less than 100 characters' })
  alt_text?: string;

  @Column({ nullable: false, default: 0 })
  display_order: number;

  @Column({ nullable: false, default: true })
  is_active: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;

  @ManyToOne(() => User, (user) => user.profileGallery)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: false })
  user_id: string;
} 