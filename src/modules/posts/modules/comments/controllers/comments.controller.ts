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
import { SUCCESS_MESSAGES } from '@app/shared/constants/constants';
import { CommentReactionsService } from '../../comment-reactions/services/comment-reaction.service';

@ApiTags('Comments')
@Controller('comment')
@UseGuards(CognitoGuard)
export class CommentsController {
  constructor(private commentReactionService: CommentReactionsService) {}

  @Post('like/:id')
  async likeAComment(
    @Res() res: Response,
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    try {
      const commentReaction = await this.commentReactionService.likeAComment({
        commentId: id,
        likedBy: req?.user?.id || '',
      });
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.COMMENT_LIKED_SUCCESS,
        data: commentReaction,
      });
    } catch (error) {
      console.error(
        '🚀 ~ CommentReactionController ~ likeAComment ~ error:',
        error,
      );
      throw error;
    }
  }

  @Post('dislike/:id')
  async dislikeAComment(
    @Res() res: Response,
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    try {
      const commentReaction = await this.commentReactionService.dislikeAComment(
        {
          commentId: id,
          likedBy: req?.user?.id || '',
        },
      );
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.COMMENT_DISLIKED_SUCCESS,
        data: commentReaction,
      });
    } catch (error) {
      console.error(
        '🚀 ~ CommentReactionController ~ likeAComment ~ error:',
        error,
      );
      throw error;
    }
  }
}
