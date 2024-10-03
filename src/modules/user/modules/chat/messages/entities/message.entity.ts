import { IsNotEmpty, IsUUID } from 'class-validator';
import { User } from '@user/entities/user.entity';
import {
  BaseEntity,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Conversations } from '../../conversations/entities/conversation.entity';

@Entity({ name: 'messages' })
@Unique(['id'])
export class Message extends BaseEntity {
  @Column()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @IsUUID()
  @Index()
  sender_id: string;

  @ManyToOne(() => User, (user) => user.messageSentBy)
  @JoinColumn({ name: 'sender_id' })
  messageSender: User;

  @Column()
  @IsUUID()
  @Index()
  conversation_id: string;

  @ManyToOne(() => Conversations, (conversation) => conversation.message)
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversations;

  @Column({ type: 'varchar' })
  @IsNotEmpty({ message: 'Message is required' })
  message: string;

  @Column({ type: 'varchar', nullable: true })
  url: string;

  @Column({ default: false })
  is_read: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;
}
