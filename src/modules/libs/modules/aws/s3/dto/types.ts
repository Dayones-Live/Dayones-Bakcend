import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class PresignedUrlInput {
  @IsNotEmpty()
  @IsString()
  path: string;

  @IsNotEmpty()
  @IsString()
  fileMimeType: string;

  @IsNotEmpty()
  @IsBoolean()
  isUpload: boolean;
}
