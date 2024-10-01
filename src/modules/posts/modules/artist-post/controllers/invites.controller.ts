import { CognitoGuard } from '@auth/guards/aws.cognito.guard';
import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { UpdateArtistPostUserInput } from '../../artist-post-user/dto/types';
import { UserService } from '@app/modules/user/services/user.service';
import { ArtistPostUserService } from '../../artist-post-user/services/artist-post-user.service';

@Controller('invites')
@UseGuards(CognitoGuard)
export class InvitesController {
  constructor(
    private userService: UserService,
    private artistPostUserService: ArtistPostUserService,
  ) {}

  @Patch(':id')
  async updateArtistPostUserInvite(
    @Param('id') inviteId: string,
    @Body() updateArtistPostUserInput: UpdateArtistPostUserInput,
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
      const response = await this.artistPostUserService.updateArtistPostUser({
        ...updateArtistPostUserInput,
        userId: user_id,
        id: inviteId,
      });
      res
        .status(HttpStatus.CREATED)
        .json({ message: 'Artist Post update Successful', data: response });
    } catch (error) {
      console.error(
        '🚀 ~ ArtistPostUserController ~ updateArtistPostUser ~ error:',
        error,
      );
      throw error;
    }
  }

  @Get()
  async getAllInvitesOfArtist(@Res() res: Response, @Req() req: Request) {
    try {
      const { id: user_id } = await this.userService.findUserByUserSub(
        req?.userSub || '',
      );
      if (!user_id) {
        throw new HttpException(`User not found}`, HttpStatus.NOT_FOUND);
      }
      const response =
        await this.artistPostUserService.fetchValidArtistInvites(user_id);
      res.status(HttpStatus.CREATED).json({
        message: 'Artist Valid Invites fetched Successful',
        data: response,
      });
    } catch (error) {
      console.error(
        '🚀 ~ ArtistPostUserController ~ getAllInvitesOfArtist ~ error:',
        error,
      );
      throw error;
    }
  }
}
