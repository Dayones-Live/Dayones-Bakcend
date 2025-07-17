import { IsOptional, IsNotEmpty, IsString, IsNumber, IsBoolean, Length, IsUrl } from 'class-validator';

export class ProfileUpdateInput {
  @IsOptional()
  @IsString()
  @Length(0, 500, { message: 'Bio must be less than 500 characters' })
  bio?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000, { message: 'Description must be less than 1000 characters' })
  description?: string;

  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'Website must be a valid URL' })
  website?: string;

  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  @IsString()
  twitter?: string;

  @IsOptional()
  @IsString()
  facebook?: string;

  @IsOptional()
  @IsString()
  tiktok?: string;

  @IsOptional()
  @IsString()
  youtube?: string;
}

export class GalleryImageInput {
  @IsNotEmpty({ message: 'Image URL is required' })
  @IsString()
  @IsUrl({}, { message: 'Image URL must be a valid URL' })
  image_url: string;

  @IsOptional()
  @IsString()
  @Length(0, 200, { message: 'Caption must be less than 200 characters' })
  caption?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100, { message: 'Alt text must be less than 100 characters' })
  alt_text?: string;

  @IsOptional()
  @IsNumber()
  display_order?: number;
}

export class GalleryImageUpdateInput {
  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'Image URL must be a valid URL' })
  image_url?: string;

  @IsOptional()
  @IsString()
  @Length(0, 200, { message: 'Caption must be less than 200 characters' })
  caption?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100, { message: 'Alt text must be less than 100 characters' })
  alt_text?: string;

  @IsOptional()
  @IsNumber()
  display_order?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class GetUserProfileInput {
  @IsNotEmpty({ message: 'User ID is required' })
  @IsString()
  userId: string;
} 