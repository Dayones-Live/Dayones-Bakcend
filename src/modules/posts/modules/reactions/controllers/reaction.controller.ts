import { CognitoGuard } from '@auth/guards/aws.cognito.guard';
import { UserService } from '@user/services/user.service';
import {
  Body,
  Controller,
  Delete,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { ReactionService } from '../services/reactions.service';
import { CreateReactionInput } from '../dto/types';

@ApiTags('Reaction')
@Controller('reaction')
@UseGuards(CognitoGuard)
export class ReactionsController {
  constructor(
    private reactionService: ReactionService,
    private userService: UserService,
  ) {}
}
