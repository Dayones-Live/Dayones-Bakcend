import { IsNotEmpty, IsUUID } from 'class-validator';
import { User } from 'src/modules/user/entities/user.entity';
import {
  BaseEntity,
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'user-notifications' })
@Unique(['id'])
export class UserNotification extends BaseEntity {
  @Column()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  user_id?: string;

  @OneToOne(() => User, (user) => user.userNotification, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  @IsNotEmpty({ message: 'Notification Token is required' })
  @Index()
  notification_token: string;
}
