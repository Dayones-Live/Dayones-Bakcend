import { IsNotEmpty, IsUUID } from 'class-validator';
import { User } from '@user/entities/user.entity';
import {
  BaseEntity,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Message } from '../../messages/entities/message.entity';

@Entity({ name: 'conversations' })
@Unique(['id'])
export class Conversations extends BaseEntity {
  @Column()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @IsUUID()
  @Index()
  sender_id: string;

  @ManyToOne(() => User, (user) => user.sentBy)
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column()
  @IsUUID()
  @Index()
  reciever_id: string;

  @ManyToOne(() => User, (user) => user.recievedBy)
  @JoinColumn({ name: 'reciever_id' })
  reciever: User;

  @Column({ type: 'varchar', nullable: true })
  last_message: string;

  @Column()
  @IsNotEmpty({ message: 'Sender reciever code is required' })
  sender_reciever_code: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;

  @OneToMany(() => Message, (message) => message.conversation)
  message: Message[];
}
