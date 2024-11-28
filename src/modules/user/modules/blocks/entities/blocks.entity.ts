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
import { User } from '@user/entities/user.entity';
import { IsUUID } from 'class-validator';

@Entity('blocks')
@Unique(['id'])
export class Blocks extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @IsUUID()
  @Index()
  blocked_by: string;

  @ManyToOne(() => User, (user) => user.blockedBy)
  @JoinColumn({ name: 'blocked_by' })
  blockedBy: User; // The user who is blocking another user.

  @Column()
  @IsUUID()
  @Index()
  blocked_user: string;

  @ManyToOne(() => User, (user) => user.blockedUser)
  @JoinColumn({ name: 'blocked_user' })
  blockedUser: User; // The user who is being blocked.

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;
}
