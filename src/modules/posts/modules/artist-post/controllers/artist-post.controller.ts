import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Delete,
  Post,
  Req,
  Res,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { ArtistPostService } from '../services/artist-post.service';
import { CreateArtistPostInput, UpdateArtistPostInput } from '../dto/types';
import { CognitoGuard } from '@auth/guards/aws.cognito.guard';
import { UserService } from '@user/services/user.service';
import {
  ERROR_MESSAGES,
  Roles,
  SUCCESS_MESSAGES,
} from '@app/shared/constants/constants';
import { CommentsService } from '../../comments/services/commnets.service';
import { CreateCommentInput } from '../../comments/dto/types';
import { ReactionService } from '../../reactions/services/reactions.service';
import { CreateReactionInput } from '../../reactions/dto/types';
import { Role } from '@app/modules/auth/decorators/roles.decorator';
import { User } from '@user/entities/user.entity';

@ApiTags('Artist-post')
@Controller('post')
@UseGuards(CognitoGuard)
export class ArtistPostController {
  constructor(
    private artistPostService: ArtistPostService,
    private userService: UserService,
    private commentService: CommentsService,
    private reactionService: ReactionService,
  ) {}

  @Post()
  @Role(Roles.ARTIST)
  async createArtistPost(
    @Body() createArtistPostInput: CreateArtistPostInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const artistPost = await this.artistPostService.createArtistPost({
        ...createArtistPostInput,
        userId: req?.user?.id || '',
      });
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.POST_CREATED_SUCCESS,
        data: artistPost,
      });
    } catch (error) {
      console.error(
        '🚀 ~ ArtistPostController ~ createArtistPost ~ error:',
        error,
      );
      throw error;
    }
  }

  @Patch(':id')
  @Role(Roles.ARTIST)
  async updateArtistPost(
    @Param('id') id: string,
    @Body() updateArtistPostInput: UpdateArtistPostInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      updateArtistPostInput.id = id;
      const response = await this.artistPostService.updateArtistPost({
        ...updateArtistPostInput,
        userId: req?.user?.id || '',
      });
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.POST_UPDATED_SUCCESS,
        data: response,
      });
    } catch (error) {
      console.error(
        '🚀 ~ ArtistPostController ~ updateArtistPost ~ error:',
        error,
      );
      throw error;
    }
  }

  @Delete(':id')
  @Role(Roles.ARTIST)
  async deleteArtistPost(
    @Param('id') id: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const response = await this.artistPostService.deleteArtistPostById(
        id,
        req?.user?.id || '',
      );
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.POST_DELETED_SUCCESS,
        data: response,
      });
    } catch (error) {
      console.error(
        '🚀 ~ ArtistPostController ~ upsertUserSignature ~ error:',
        error,
      );
      throw error;
    }
  }

  @Get()
  async getAllUserPostsData(@Res() res: Response, @Req() req: Request) {
    try {
      const postsData = await this.artistPostService.fetchAllUserPostsData(
        req?.user as User,
      );
      res.status(HttpStatus.OK).json({
        message: SUCCESS_MESSAGES.POSTS_FETCHED_SUCCESS,
        data: postsData,
      });
    } catch (error) {
      console.error(
        '🚀 ~ ArtistPostController ~ getAllUserPostsData ~ error:',
        error,
      );
      throw error;
    }
  }

  @Get('/:id')
  async getPostData(
    @Param('id') id: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const response = await this.artistPostService.fetchPostDataById(
        req?.user as User,
        id,
      );
      res.status(HttpStatus.OK).json({
        message: SUCCESS_MESSAGES.POST_FETCHED_SUCCESS,
        data: response,
      });
    } catch (error) {
      console.error('🚀 ~ ArtistPostController ~ getPostData ~ error:', error);
      throw error;
    }
  }

  @Post('/:id/comment')
  @Role(Roles.USER)
  async CommentAPost(
    @Param('id') id: string,
    @Body() createCommentInput: CreateCommentInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const comment = await this.commentService.commentAPost(
        createCommentInput,
        id,
        req?.user?.id || '',
      );
      res.status(HttpStatus.OK).json({
        message: SUCCESS_MESSAGES.COMMENT_CREATED_SUCCESS,
        data: comment,
      });
    } catch (error) {
      console.error('🚀 ~ ArtistPostController ~ getPostData ~ error:', error);
      throw error;
    }
  }

  @Post('/:id/likes')
  @Role(Roles.USER)
  async likeAPost(
    @Param('id') id: string,
    @Body() createReactionInput: CreateReactionInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const like = await this.reactionService.likeAPost(
        createReactionInput,
        id,
        req?.user?.id || '',
      );
      res
        .status(HttpStatus.OK)
        .json({ message: SUCCESS_MESSAGES.LIKE_ADDED_SUCCESS, data: like });
    } catch (error) {
      console.error('🚀 ~ ArtistPostController ~ getPostData ~ error:', error);
      throw error;
    }
  }

  @Delete('/:postId/comment/:id')
  @Role(Roles.USER)
  async deleteAComment(
    @Param('id') id: string,
    @Param('postId') postId: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const response = await this.commentService.deleteCommentById(
        id,
        postId,
        req?.user as User,
      );
      res.status(HttpStatus.OK).json({
        message: SUCCESS_MESSAGES.COMMENT_DELETED_SUCCESS,
        data: response,
      });
    } catch (error) {
      console.error('🚀 ~ CommentsController ~ updateComment ~ error:', error);
      throw error;
    }
  }

  @Delete('/:id/likes')
  @Role(Roles.USER)
  async deletePostReaction(
    @Param('id') postId: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const response = await this.reactionService.deleteReactionById(
        postId,
        req?.user as User,
      );
      res.status(HttpStatus.OK).json({
        message: SUCCESS_MESSAGES.LIKE_DELETED_SUCCESS,
        data: response,
      });
    } catch (error) {
      console.error(
        '🚀 ~ CommentsController ~ deletePostReaction ~ error:',
        error,
      );
      throw error;
    }
  }
}
