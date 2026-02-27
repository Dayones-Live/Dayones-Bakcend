import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateConnectAccountDto {
  @IsNotEmpty()
  @IsUUID()
  userId: string;
}
