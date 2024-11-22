import { User } from '@app/modules/user/entities/user.entity';
import { IsUUID, Max, Min } from 'class-validator';
import {
  BaseEntity,
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('feedback')
export class Feedback extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  @Min(0, { message: 'Rating must be at least 0' })
  @Max(5, { message: 'Rating must be at most 5' })
  rating: number;

  @Column({ nullable: false })
  @IsUUID()
  @Index()
  feedback_by: string;

  @OneToOne(() => User, (user) => user.feedback, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'feedback_by' })
  user: User;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;
}
