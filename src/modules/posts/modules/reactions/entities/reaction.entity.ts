import { IsUUID } from 'class-validator';
import {
  BaseEntity,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ArtistPostUser } from '../../artist-post-user/entities/artist-post-user.entity';
import { User } from '@user/entities/user.entity';

@Entity({ name: 'reactions' })
@Unique(['id'])
export class Reactions extends BaseEntity {
  @Column()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  @IsUUID()
  @Index()
  artist_post_user_id: string;

  @OneToOne(() => ArtistPostUser, (artistPostUser) => artistPostUser.reaction, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'artist_post_user_id' })
  artistPostUser: ArtistPostUser;

  @Column({ nullable: true })
  @IsUUID()
  @Index()
  react_by: string;

  @ManyToOne(() => User, (user) => user.reaction, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'react_by' })
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
