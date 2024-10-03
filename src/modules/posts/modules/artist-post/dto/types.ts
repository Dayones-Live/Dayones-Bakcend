import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { Post_Type } from '../constants';

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

export class UpdateArtistPostInput {
  @IsNotEmpty({ message: 'Id is required' })
  @IsUUID()
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

  @IsOptional()
  longitude: string;

  @IsOptional()
  latitude: string;

  @IsOptional()
  locale: string;
}

export class ArtistPostObject {
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

  @IsOptional()
  longitude: string;

  @IsOptional()
  latitude: string;

  @IsOptional()
  locale: string;
}
export class Comment {
  @IsOptional()
  userId: string; // User ID from artistPostUser

  @IsOptional()
  message: string; // Message from comment
}
export class ArtistPostResponse {
  @IsOptional()
  post?: ArtistPostObject | null;

  @IsOptional()
  comments?: Comment[];

  @IsOptional()
  reaction?: number;
}
