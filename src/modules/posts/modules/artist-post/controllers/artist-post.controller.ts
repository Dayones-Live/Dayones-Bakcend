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
import { Roles } from '@app/shared/constants/constants';
import { CommentsService } from '../../comments/services/commnets.service';
import { CreateCommentInput } from '../../comments/dto/types';
import { ReactionService } from '../../reactions/services/reactions.service';
import { CreateReactionInput } from '../../reactions/dto/types';

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
  async createArtistPost(
    @Body() createArtistPostInput: CreateArtistPostInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const { id: user_id, role } = await this.userService.findUserByUserSub(
        req?.userSub || '',
      );
      if (!user_id) {
        throw new HttpException(`User not found}`, HttpStatus.NOT_FOUND);
      }
      if (role[0] !== Roles.ARTIST) {
        throw new HttpException(
          `Don't have access to Post Creation`,
          HttpStatus.FORBIDDEN,
        );
      }
      const artistPost = await this.artistPostService.createArtistPost({
        ...createArtistPostInput,
        userId: user_id,
      });
      res.status(HttpStatus.CREATED).json({
        message: 'Artist post creation successfully',
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

  @Patch()
  async updateArtistPost(
    @Body() updateArtistPostInput: UpdateArtistPostInput,
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
      const response = await this.artistPostService.updateArtistPost({
        ...updateArtistPostInput,
        userId: user_id,
      });
      res
        .status(HttpStatus.CREATED)
        .json({ message: 'Artist Post update Successful', data: response });
    } catch (error) {
      console.error(
        '🚀 ~ ArtistPostController ~ updateArtistPost ~ error:',
        error,
      );
      throw error;
    }
  }

  @Delete(':id')
  async deleteArtistPost(
    @Param('id') id: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const { id: user_id, role } = await this.userService.findUserByUserSub(
        req?.userSub || '',
      );
      if (!user_id) {
        throw new HttpException(`User not found}`, HttpStatus.NOT_FOUND);
      }
      if (role[0] !== Roles.ARTIST) {
        throw new HttpException(
          `Don't have access to Post Deletion`,
          HttpStatus.FORBIDDEN,
        );
      }
      const response = await this.artistPostService.deleteArtistPostById(
        id,
        user_id,
      );
      res
        .status(HttpStatus.CREATED)
        .json({ message: 'Artist Post delete successful', data: response });
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
      const user = await this.userService.findUserByUserSub(req?.userSub || '');
      if (!user?.id) {
        throw new HttpException(`User not found}`, HttpStatus.NOT_FOUND);
      }

      const postsData =
        await this.artistPostService.fetchAllUserPostsData(user);
      res
        .status(HttpStatus.OK)
        .json({ message: 'Data Fetched Successfully', data: postsData });
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
      const user = await this.userService.findUserByUserSub(req?.userSub || '');
      if (!user?.id) {
        throw new HttpException(`User not found}`, HttpStatus.NOT_FOUND);
      }

      const response = await this.artistPostService.fetchPostDataById(user, id);
      res
        .status(HttpStatus.OK)
        .json({ message: 'Data Fetched Successfully', data: response });
    } catch (error) {
      console.error('🚀 ~ ArtistPostController ~ getPostData ~ error:', error);
      throw error;
    }
  }

  @Post('/:id/comment')
  async CommentAPost(
    @Param('id') id: string,
    @Body() createCommentInput: CreateCommentInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const user = await this.userService.findUserByUserSub(req?.userSub || '');
      if (!user?.id) {
        throw new HttpException(`User not found}`, HttpStatus.NOT_FOUND);
      }
      if (user.role[0] === Roles.ARTIST) {
        throw new HttpException(
          `Don't have access to Post Creation}`,
          HttpStatus.FORBIDDEN,
        );
      }
      const comment = await this.commentService.commentAPost(
        createCommentInput,
        id,
        user?.id,
      );
      res
        .status(HttpStatus.OK)
        .json({ message: 'Data Fetched Successfully', data: comment });
    } catch (error) {
      console.error('🚀 ~ ArtistPostController ~ getPostData ~ error:', error);
      throw error;
    }
  }

  @Post('/:id/likes')
  async likeAPost(
    @Param('id') id: string,
    @Body() createReactionInput: CreateReactionInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const user = await this.userService.findUserByUserSub(req?.userSub || '');
      if (!user?.id) {
        throw new HttpException(`User not found}`, HttpStatus.NOT_FOUND);
      }
      if (user.role[0] === Roles.ARTIST) {
        throw new HttpException(
          `Don't have access to Post Creation}`,
          HttpStatus.FORBIDDEN,
        );
      }
      const like = await this.reactionService.likeAPost(
        createReactionInput,
        id,
        user?.id,
      );
      res
        .status(HttpStatus.OK)
        .json({ message: 'Data Fetched Successfully', data: like });
    } catch (error) {
      console.error('🚀 ~ ArtistPostController ~ getPostData ~ error:', error);
      throw error;
    }
  }
}
