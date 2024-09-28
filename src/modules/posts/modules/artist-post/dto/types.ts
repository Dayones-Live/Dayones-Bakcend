import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { POST_TYPE } from '../constants';

export class CreateArtistPostInput {
  @IsOptional()
  user_id: string;

  @IsNotEmpty({ message: 'Image Url is required' })
  image_url: string;

  @IsOptional()
  message: string;

  @IsNotEmpty({ message: 'Range is required' })
  range: number;

  @IsNotEmpty({ message: 'Type is required' })
  type: POST_TYPE;
}

export class UpdateArtistPostInput {
  @IsNotEmpty({ message: 'Id is required' })
  @IsUUID()
  id: string;

  @IsOptional()
  user_id: string;

  @IsOptional()
  image_url: string;

  @IsOptional()
  message: string;

  @IsOptional()
  range: number;

  @IsOptional()
  type: POST_TYPE;
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
  type: POST_TYPE;
}
