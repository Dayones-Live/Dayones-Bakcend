import { IsNotEmpty, IsEnum, IsEmail, IsOptional } from 'class-validator';
import { Roles } from 'src/shared/constants';

export class UserSignUpInput {
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email: string;

  @IsOptional()
  @IsNotEmpty({ message: 'Password is required' })
  password?: string;

  @IsNotEmpty({ message: 'Role is required' })
  @IsEnum(Roles, { message: 'Role must be one of: USER, ARTIST' })
  role: Roles;

  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @IsNotEmpty({ message: 'Phone number is required' })
  phone_number: string;
}

export class CreateUserInput extends UserSignUpInput {
  @IsNotEmpty({ message: 'User Sub is required' })
  user_sub: string;

  @IsNotEmpty({ message: 'Is Confirmed is required' })
  is_confirmed: boolean;
}

export class UserConfirmationInput {
  @IsNotEmpty({ message: 'User Name is required' })
  username: string;

  @IsNotEmpty({ message: 'Confirmation Code is required' })
  confirmationCode: string;
}

export class ResendConfirmationCodeInput {
  @IsNotEmpty({ message: 'User Name is required' })
  username: string;
}

export class SignInUserInput {
  @IsNotEmpty({ message: 'User Name is required' })
  @IsEmail({}, { message: 'User name must be a valid email address' })
  username: string;

  @IsOptional()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
