import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserService } from '../services/user.service';
import { ROLES } from 'src/shared/constants';

@ApiTags('user')
@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}
}
