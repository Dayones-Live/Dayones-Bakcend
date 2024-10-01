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
import { ReactionService } from '../services/reactions.service';
import { CreateReactionInput } from '../dto/types';

@ApiTags('Reaction')
@Controller('reaction')
@UseGuards(CognitoGuard)
export class ReactionsController {
  constructor(
    private reactionService: ReactionService,
    private userService: UserService,
  ) {}

  @Delete(':id')
  async deleteReaction(
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
      const response = await this.reactionService.deleteReactionById(id);
      res.status(HttpStatus.CREATED).json({
        message: 'React delete successful',
        data: response,
      });
    } catch (error) {
      console.error(
        '🚀 ~ ReactionsController ~ deleteReaction ~ error:',
        error,
      );
      throw error;
    }
  }
}
