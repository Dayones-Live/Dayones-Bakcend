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
import { CommentsService } from '../services/commnets.service';
import { CreateCommentInput, UpdateCommentInput } from '../dto/types';

@ApiTags('Comments')
@Controller('comment')
@UseGuards(CognitoGuard)
export class CommentsController {
  constructor(
    private commentsService: CommentsService,
    private userService: UserService,
  ) {}
}
