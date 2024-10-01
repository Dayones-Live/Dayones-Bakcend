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
}
