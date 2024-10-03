import { IsNotEmpty, IsOptional } from 'class-validator';

export class CreateUserSignatureInput {
  @IsOptional()
  userId: string;

  @IsNotEmpty({ message: 'Url is required' })
  url: string;
}
