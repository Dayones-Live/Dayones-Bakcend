import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
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
import { Post_Type } from '../constants';
import { ArtistPostUser } from '../../artist-post-user/entities/artist-post-user.entity';
import { Report } from '@app/modules/report/entities/report.entity';

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
  @IsOptional()
  message: string;

  @Column({ nullable: true })
  @IsOptional()
  image_url: string;

  @Column({ nullable: true })
  @IsOptional()
  range: number;

  @Column({ type: 'enum', enum: Post_Type, nullable: false })
  @IsNotEmpty({ message: 'Post Type is required' })
  type: Post_Type;

  @OneToMany(
    () => ArtistPostUser,
    (artistPostUser) => artistPostUser.artistPost,
  )
  artistPostUser?: ArtistPostUser[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;

  @Column({ nullable: true })
  @IsOptional()
  longitude: string;

  @Column({ nullable: true })
  @IsOptional()
  latitude: string;

  @Column({ nullable: true })
  @IsOptional()
  locale: string;

  @OneToMany(() => Report, (report) => report.reportedPost)
  report?: Report[];
}
