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
import { GlobalServiceResponse } from '@app/shared/types/types';

@Controller('blocks')
export class BlocksController {
  constructor(private blockService: BlocksService) {}

  /**
   *  Service to block a user
   * @param blockUserInput
   * @param res
   * @param req
   * @return {GlobalServiceResponse}
   *
   * @throws Error if blocking yourself or blocking, already blocked user and user that doesn't exist
   */
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

  /**
   *  Service to unblock a user
   * @param blockUserInput
   * @param res
   * @param req
   * @return {GlobalServiceResponse}
   *
   * @throws Error if unblocking a not blocked user
   */
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

  /**
   *  Service to get all blocked user of current logged in user
   * @param res
   * @param req
   * @query pageNo
   * @query pageSize
   * @return {GlobalServiceResponse}
   */
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
