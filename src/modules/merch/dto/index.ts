import { IsNotEmpty, IsUUID, IsArray, ValidateNested, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMerchDropDto {
  @IsNotEmpty()
  @IsUUID()
  artistPostId: string;
}

export class OrderItemDto {
  @IsNotEmpty()
  @IsUUID()
  merchProductId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  color?: string;
}

export class ShippingAddressDto {
  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  address1: string;

  @IsOptional()
  address2?: string;

  @IsNotEmpty()
  city: string;

  @IsNotEmpty()
  state_code: string;

  @IsNotEmpty()
  country_code: string;

  @IsNotEmpty()
  zip: string;
}

export class CreateMerchOrderDto {
  @IsNotEmpty()
  @IsUUID()
  merchDropId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;
}
