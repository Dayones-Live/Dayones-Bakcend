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

  @Post()
  async createComment(
    @Body() createCommentInput: CreateCommentInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const { id: user_id } = await this.userService.findUserByUserSub(
        req?.userSub || '',
      );
      if (!user_id) {
        throw new HttpException(`User not found}`, HttpStatus.NOT_FOUND);
      }
      const response =
        await this.commentsService.createComment(createCommentInput);
      res.status(HttpStatus.CREATED).json({
        message: 'Comment creation successful',
        data: response,
      });
    } catch (error) {
      console.error('🚀 ~ CommentsController ~ createComment ~ error:', error);
      throw error;
    }
  }

  @Patch()
  async updateComment(
    @Body() updateCommentInput: UpdateCommentInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const { id: user_id } = await this.userService.findUserByUserSub(
        req?.userSub || '',
      );
      if (!user_id) {
        throw new HttpException(`User not found}`, HttpStatus.NOT_FOUND);
      }
      const response =
        await this.commentsService.updateComment(updateCommentInput);
      res
        .status(HttpStatus.CREATED)
        .json({ message: 'Comment update Successful', data: response });
    } catch (error) {
      console.error('🚀 ~ CommentsController ~ updateComment ~ error:', error);
      throw error;
    }
  }

  @Delete(':id')
  async deleteComment(
    @Param('id') id: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const { id: user_id } = await this.userService.findUserByUserSub(
        req?.userSub || '',
      );
      if (!user_id) {
        throw new HttpException(`User not found}`, HttpStatus.NOT_FOUND);
      }
      const response = await this.commentsService.deleteCommentById(id);
      res.status(HttpStatus.CREATED).json({
        message: 'Comment delete successful',
        data: response,
      });
    } catch (error) {
      console.error(
        '🚀 ~ ArtistPostUserController ~ deleteArtistPostUser ~ error:',
        error,
      );
      throw error;
    }
  }
}
