import { PASSWORD_REGEX, ROLES } from 'src/shared/constants';
import {
  BaseEntity,
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { IsEmail, IsNotEmpty, Length, Matches } from 'class-validator';

@Entity('user')
@Unique(['email'])
@Unique(['phone_number'])
export class User extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  @Index()
  @IsNotEmpty({ message: 'Full Name cannot be empty' })
  @Length(3, 20, { message: 'Full Name must be between 3 and 20 characters' })
  full_name?: string;

  @Column({ nullable: false })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @Column({ nullable: false })
  @IsNotEmpty({ message: 'Phone no is required' })
  @Index()
  phone_number: string;

  @Column({ nullable: false, default: false })
  is_confirmed: boolean = false;

  @Column({ type: 'enum', enum: ROLES, array: true, default: [ROLES.USER] })
  @IsNotEmpty({ message: 'Role is required' })
  role: ROLES[];

  @Column({ nullable: false })
  @IsNotEmpty({ message: 'User Sub is required' })
  @Index()
  user_sub: string;

  @Column({ nullable: true })
  latitude: string;

  @Column({ nullable: true })
  longitude: string;

  @Column({ nullable: true })
  avatar_url: string;

  @Column({ nullable: true })
  notification_token: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;
}
