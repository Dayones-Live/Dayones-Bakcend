import { IsNotEmpty, IsUUID } from 'class-validator';
import { User } from '@app/modules/user/entities/user.entity';
import {
  BaseEntity,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NOTIFICATION_TYPE } from '../constants';

export type NOTIFICATION_TYPE = typeof NOTIFICATION_TYPE[keyof typeof NOTIFICATION_TYPE];

@Entity({ name: 'notifications' })
@Unique(['id'])
export class Notifications extends BaseEntity {
  @Column()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @IsUUID()
  @Index()
  from_id: string;

  @ManyToOne(() => User, (user) => user.from)
  @JoinColumn({ name: 'from_id' })
  fromUser: User;

  @Column()
  @IsUUID()
  @Index()
  to_id: string;

  @ManyToOne(() => User, (user) => user.to)
  @JoinColumn({ name: 'to_id' })
  toUser: User;

  @Column({ nullable: false })
  @IsNotEmpty({ message: 'Title is required' })
  title: string;

  @Column({ nullable: false })
  @IsNotEmpty({ message: 'message is required' })
  message: string;

  @Column({ nullable: true })
  data: string;

  @Column({ nullable: false })
  @IsNotEmpty({ message: 'isRead type is required' })
  is_read: boolean;

  @Column({ type: 'enum', enum: NOTIFICATION_TYPE })
  @IsNotEmpty({ message: 'Notification type is required' })
  type: NOTIFICATION_TYPE;

  @Column({ nullable: true })
  post_id: string;

  @Column({ nullable: true })
  conversation_id: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
} 