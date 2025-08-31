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
  Logger,
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
  private readonly logger = new Logger(InvitesController.name);

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
      const userId = req?.user?.id || '';
      this.logger.log(`🎯 [INVITE_ENDPOINT] User ${userId} updating invite ${inviteId} to status: ${updateArtistPostUserInput.status}`);
      
      const response = await this.artistPostUserService.updateArtistPostUser({
        ...updateArtistPostUserInput,
        userId: userId,
        id: inviteId,
      });
      
      this.logger.log(`🎯 [INVITE_ENDPOINT] ✅ User ${userId} successfully updated invite ${inviteId} to status: ${updateArtistPostUserInput.status}`);
      
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.POST_UPDATED_SUCCESS,
        data: response,
      });
    } catch (error) {
      this.logger.error(`🎯 [INVITE_ENDPOINT] ❌ Error updating invite ${inviteId}: ${error?.message}`);
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
      const user = req?.user as User;
      this.logger.log(`🎯 [INVITE_ENDPOINT] User ${user.id} (${user.full_name || 'Unknown'}) fetching all invites`);
      
      const response = await this.artistPostUserService.fetchValidArtistInvites(user);
      
      this.logger.log(`🎯 [INVITE_ENDPOINT] ✅ User ${user.id} fetched ${Array.isArray(response) ? response.length : 'unknown number of'} invites`);
      
      // Log details of invites returned
      if (Array.isArray(response)) {
        for (const invite of response) {
          // Check if this is an ArtistPostUser (has artistPost property) or UserInvitesResponse
          if ('artistPost' in invite && invite.artistPost) {
            this.logger.log(`🎯 [INVITE_ENDPOINT] User ${user.id} has invite to post ${invite.artist_post_id} by artist ${invite.artistPost.user_id} with status ${invite.status}`);
          } else if ('artist_post_id' in invite) {
            // This is a UserInvitesResponse
            this.logger.log(`🎯 [INVITE_ENDPOINT] User ${user.id} has invite to post ${invite.artist_post_id} with status ${invite.status}`);
          }
        }
      }
      
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.INVITES_FETCH_SUCCESS,
        data: response,
      });
    } catch (error) {
      const user = req?.user as User;
      this.logger.error(`🎯 [INVITE_ENDPOINT] ❌ Error fetching invites for user ${user?.id}: ${error?.message}`);
      console.error(
        '🚀 ~ ArtistPostUserController ~ getAllInvitesOfArtist ~ error:',
        error,
      );
      throw error;
    }
  }
}
