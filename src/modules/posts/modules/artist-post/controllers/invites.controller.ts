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
import { Roles } from '@app/shared/constants/constants';

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
      const { id: user_id, role } = await this.userService.findUserByUserSub(
        req?.userSub || '',
      );
      if (!user_id) {
        throw new HttpException(`User not found}`, HttpStatus.NOT_FOUND);
      }
      if (role[0] === Roles.ARTIST) {
        throw new HttpException(
          `Don't have access to update a comment`,
          HttpStatus.FORBIDDEN,
        );
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
  async getAllInvitesOfUser(@Res() res: Response, @Req() req: Request) {
    try {
      const user = await this.userService.findUserByUserSub(req?.userSub || '');
      if (!user) {
        throw new HttpException(`User not found}`, HttpStatus.NOT_FOUND);
      }
      const response =
        await this.artistPostUserService.fetchValidArtistInvites(user);
      res.status(HttpStatus.CREATED).json({
        message: 'Invites fetched Successful',
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
