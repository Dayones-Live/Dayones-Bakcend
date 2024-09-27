import { IsNotEmpty, IsUUID } from 'class-validator';
import { User } from 'src/modules/user/entities/user.entity';
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

@Entity({ name: 'signatures' })
@Unique(['id'])
export class Signatures extends BaseEntity {
  @Column()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @IsUUID()
  @Index()
  user_id: string;

  @ManyToOne(() => User, (user) => user.signature, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  @IsNotEmpty({ message: 'Url is required' })
  url: string;
}
