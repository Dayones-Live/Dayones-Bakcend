import { IsNotEmpty, IsOptional } from 'class-validator';

export class CreateUserSignatureInput {
  @IsOptional()
  userId: string;

  @IsOptional()
  url: string;
}
