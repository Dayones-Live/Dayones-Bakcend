import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateUserSignatureInput {
  @IsOptional()
  userId: string;

  @IsNotEmpty({ message: 'Url is required' })
  url: string;
}
