import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateUserSignatureInput {
  @IsOptional()
  user_id: string;

  @IsNotEmpty({ message: 'Url is required' })
  url: string;
}
