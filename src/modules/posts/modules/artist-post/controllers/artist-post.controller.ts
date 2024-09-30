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

@ApiTags('signature')
@Controller('artist-post')
@UseGuards(CognitoGuard)
export class ArtistPostController {
  constructor(
    private artistPostService: ArtistPostService,
    private userService: UserService,
  ) {}

  @Post()
  async createArtistPost(
    @Body() createArtistPostInput: CreateArtistPostInput,
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
      const response = await this.artistPostService.createArtistPost({
        ...createArtistPostInput,
        user_id,
      });
      res
        .status(HttpStatus.CREATED)
        .json({ message: 'Artist post creation successfully', data: response });
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
        user_id,
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

  @Get()
  async getAllArtistPost(@Res() res: Response, @Req() req: Request) {
    try {
      const { id: user_id } = await this.userService.findUserByUserSub(
        req?.userSub || '',
      );
      if (!user_id) {
        throw new HttpException(`User not found}`, HttpStatus.NOT_FOUND);
      }
      const response = await this.artistPostService.fetchAllArtistPost(user_id);
      res
        .status(HttpStatus.OK)
        .json({ message: 'Signatures Fetched Successfully', data: response });
    } catch (error) {
      console.error(
        '🚀 ~ ArtistPostController ~ getAllArtistPost ~ error:',
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
      const { id: user_id } = await this.userService.findUserByUserSub(
        req?.userSub || '',
      );
      if (!user_id) {
        throw new HttpException(`User not found}`, HttpStatus.NOT_FOUND);
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
}
