import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response, Request } from 'express';

import { SUCCESS_MESSAGES } from '@app/shared/constants/constants';
import { CognitoGuard } from '@app/modules/auth/guards/aws.cognito.guard';
import { BlockUserInput } from '../dto/types';
import { BlocksService } from '../services/blocks.service';

@Controller('blocks')
export class BlocksController {
  constructor(private blockService: BlocksService) {}

  @UseGuards(CognitoGuard)
  @Post()
  async blockUser(
    @Body() blockUserInput: BlockUserInput,
    @Res()
    res: Response,
    @Req() req: Request,
  ) {
    try {
      blockUserInput.blockedBy = req?.user?.id || '';
      const blockUserResponse =
        await this.blockService.blockUser(blockUserInput);
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.USER_BLOCK_SUCCESS,
        data: blockUserResponse,
      });
    } catch (error) {
      console.error('🚀 ~ BlocksController ~ blockUser ~ error:', error);
      throw error;
    }
  }
  @UseGuards(CognitoGuard)
  @Delete(':id')
  async unblockUser(
    @Res()
    res: Response,
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    try {
      const unblockUser = await this.blockService.unblockUser({
        blockedUser: id,
        blockedBy: req?.user?.id || '',
      });
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.USER_UNBLOCK_SUCCESS,
        data: unblockUser,
      });
    } catch (error) {
      console.error('🚀 ~ BlocksController ~ unblockUser ~ error:', error);
      throw error;
    }
  }

  @UseGuards(CognitoGuard)
  @Get()
  async getAllBlockUsers(
    @Res()
    res: Response,
    @Req() req: Request,
    @Query('pageNo') pageNo: number = 1,
    @Query('pageSize') pageSize: number = 10,
  ) {
    try {
      const blockedUsers = await this.blockService.fetchAllBlockedUsers(
        req?.user?.id || '',
        { pageNo, pageSize },
      );
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.BLOCK_USER_FETCHED_SUCCESS,
        data: blockedUsers,
      });
    } catch (error) {
      console.error('🚀 ~ BlocksController ~ getAllBlockUsers ~ error:', error);
      throw error;
    }
  }
}
