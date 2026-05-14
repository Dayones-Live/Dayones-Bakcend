import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

/**
 * Generic API response envelope. Every controller wraps its payload in this shape.
 *
 * Use ApiOkResponseData(SomeDto) on routes to advertise the typed `data` field
 * to the OpenAPI spec and code-generated clients.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class GlobalServiceResponse<T = any> {
  @ApiPropertyOptional({ description: 'Typed response payload' })
  @IsOptional()
  data?: T;

  @ApiPropertyOptional({ description: 'Mirror of the HTTP status code' })
  @IsInt()
  @IsOptional()
  statusCode?: number;

  @ApiProperty({ description: 'Human-readable result message' })
  @IsString()
  @IsOptional()
  message: string;
}
