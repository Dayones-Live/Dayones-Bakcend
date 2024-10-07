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
import { ArtistPostUserService } from '../../artist-post-user/services/artist-post-user.service';
import { Roles, SUCCESS_MESSAGES } from '@app/shared/constants/constants';
import { Role } from '@app/modules/auth/decorators/roles.decorator';
import { User } from '@app/modules/user/entities/user.entity';

@Controller('invites')
@UseGuards(CognitoGuard)
export class InvitesController {
  constructor(private artistPostUserService: ArtistPostUserService) {}

  @Patch(':id')
  @Role(Roles.USER)
  async updateArtistPostUserInvite(
    @Param('id') inviteId: string,
    @Body() updateArtistPostUserInput: UpdateArtistPostUserInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const response = await this.artistPostUserService.updateArtistPostUser({
        ...updateArtistPostUserInput,
        userId: req?.user?.id || '',
        id: inviteId,
      });
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.POST_UPDATED_SUCCESS,
        data: response,
      });
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
      const response = await this.artistPostUserService.fetchValidArtistInvites(
        req?.user as User,
      );
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.INVITES_FETCH_SUCCESS,
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
