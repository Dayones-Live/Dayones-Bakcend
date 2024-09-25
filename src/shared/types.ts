import { IsOptional, IsInt, IsString } from 'class-validator';

export class GlobalServiceResponse<T = any> {
  @IsOptional()
  data?: T; // Generic type for the data field

  @IsInt()
  @IsOptional()
  statusCode: number; // Ensure statusCode is a number

  @IsString()
  @IsOptional()
  message: string; // Ensure message is a string
}
