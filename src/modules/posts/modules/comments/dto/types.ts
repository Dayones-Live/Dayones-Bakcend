import { Media_Type } from '@app/types';
import { IsNotEmpty, IsOptional, IsUUID, ValidateIf, registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

// Custom validator to ensure at least one of message or url is provided
function HasMessageOrUrl(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'hasMessageOrUrl',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const obj = args.object as CreateCommentInput;
          const hasMessage = obj.message !== undefined && obj.message !== null && String(obj.message).trim() !== '';
          const hasUrl = obj.url !== undefined && obj.url !== null && String(obj.url).trim() !== '';
          return hasMessage || hasUrl;
        },
        defaultMessage(args: ValidationArguments) {
          return 'Either message or photo (url) must be provided';
        },
      },
    });
  };
}

export class CreateCommentInput {
  @IsOptional()
  artistPostUserId?: string;

  @IsOptional()
  @HasMessageOrUrl({ message: 'Either message or photo (url) must be provided' })
  message?: string;

  @IsOptional()
  commentBy?: string;

  @IsOptional()
  parentCommentId?: string;

  @IsOptional()
  url?: string;

  @IsOptional()
  mediaType?: Media_Type;
}

export class UpdateCommentInput {
  @IsNotEmpty({ message: 'Id is required' })
  @IsUUID()
  id: string;

  @IsOptional()
  userId: string;

  @IsOptional()
  artistPostUserId: string;

  @IsOptional()
  message: string;
}
