import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { Post_Type } from '../constants';
import { Comments } from '../../comments/entities/comments.entity';
import { PaginationResponse } from '@app/types';
import { CommentsWithUserResponse } from '../../artist-post-user/dto/types';

export class CreateArtistPostInput {
  @IsOptional()
  userId: string;

  @IsOptional()
  imageUrl: string;

  @IsOptional()
  message: string;

  @IsNotEmpty({ message: 'Range is required' })
  range: number;

  @IsNotEmpty({ message: 'Type is required' })
  type: Post_Type;

  @IsNotEmpty({ message: 'Longitude is required' })
  longitude: string;

  @IsNotEmpty({ message: 'Latitude is required' })
  latitude: string;

  @IsNotEmpty({ message: 'Locale is required' })
  locale: string;
}

export class Location {
  @IsOptional()
  longitude: string;

  @IsOptional()
  latitude: string;

  @IsOptional()
  locale: string;
}

export class UpdateArtistPostInput extends Location {
  @IsOptional()
  id: string;

  @IsOptional()
  userId: string;

  @IsOptional()
  imageUrl: string;

  @IsOptional()
  message: string;

  @IsOptional()
  range: number;

  @IsOptional()
  type: Post_Type;
}

export class ArtistPostObject extends Location {
  @IsOptional()
  @IsUUID()
  id: string;

  @IsOptional()
  image_url: string;

  @IsOptional()
  message: string;

  @IsOptional()
  range: number;

  @IsOptional()
  type: Post_Type;
}

export class AllPostsResponse extends PaginationResponse {
  @IsOptional()
  posts: ArtistPostObject[];
}

export class ArtistPostResponse {
  @IsOptional()
  post?: ArtistPostObject | null;

  @IsOptional()
  comments?: CommentsWithUserResponse[];

  @IsOptional()
  reaction?: number;

  @IsOptional()
  artistComments?: CommentsWithUserResponse[];
}

export class ArtistPostWithCounts extends ArtistPostObject {
  @IsOptional()
  commentsCount: number;

  @IsOptional()
  reactionCount: number;
}
