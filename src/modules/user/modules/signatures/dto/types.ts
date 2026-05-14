import { ApiHideProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

export class CreateUserSignatureInput {
  @ApiHideProperty()
  @IsOptional()
  userId?: string;

  @IsNotEmpty({ message: 'Signature URL is required' })
  @IsUrl(undefined, { message: 'Signature URL must be a valid URL' })
  url: string;
}
