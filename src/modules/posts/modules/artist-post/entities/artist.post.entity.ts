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
import { POST_TYPE } from '../constants';

@Entity({ name: 'artist_post' })
@Unique(['id'])
export class ArtistPost extends BaseEntity {
  @Column()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  @IsUUID()
  @Index()
  user_id: string;

  @ManyToOne(() => User, (user) => user.artistPost, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: true })
  @IsNotEmpty({ message: 'Image url is required' })
  message: string;

  @Column({ nullable: false })
  @IsNotEmpty({ message: 'Image url is required' })
  image_url: string;

  @Column({ nullable: false })
  @IsNotEmpty({ message: 'type is required' })
  range: number;

  @Column({ type: 'enum', enum: POST_TYPE, nullable: false })
  @IsNotEmpty({ message: 'Post Type is required' })
  type: POST_TYPE;
}
