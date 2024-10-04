import { ApiTags } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { SendMessageInput } from '../dto/types';
import { MessageService } from '../services/message.service';
import { UserService } from '@app/modules/user/services/user.service';
import { CognitoGuard } from '@app/modules/auth/guards/aws.cognito.guard';
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from '@app/shared/constants/constants';
import {
  Body,
  Req,
  Res,
  Post,
  UseGuards,
  Controller,
  HttpStatus,
  HttpException,
  Get,
  Query,
  Param,
  Delete,
} from '@nestjs/common';

@ApiTags('message')
@Controller('message')
@UseGuards(CognitoGuard)
export class MessageController {
  constructor(
    private messageService: MessageService,
    private userService: UserService,
  ) {}
  @Post('send')
  async sendMessage(
    @Body() sendMessageInput: SendMessageInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const { id: user_id } = await this.userService.findUserByUserSub(
        req?.userSub || '',
      );

      if (!user_id) {
        throw new HttpException(
          ERROR_MESSAGES.USER_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      const response = await this.messageService.sendMessage(
        sendMessageInput,
        user_id,
      );
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.MESSAGE_SENT_SUCCESS,
        data: response,
      });
    } catch (error) {
      throw error;
    }
  }

  @Post('disconnect')
  async disconnectSocket(@Res() res: Response, @Req() req: Request) {
    try {
      const { id: user_id } = await this.userService.findUserByUserSub(
        req?.userSub || '',
      );

      if (!user_id) {
        throw new HttpException(
          ERROR_MESSAGES.USER_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      const response = await this.messageService.disconnectSocket(user_id);
      res.status(HttpStatus.OK).json({
        message: SUCCESS_MESSAGES.DISCONNECT_SOCKET_SUCCESS,
        data: response,
      });
    } catch (error) {
      throw error;
    }
  }

  @Get()
  async getAllMessages(
    @Query('pageNo') pageNo: number = 1,
    @Query('pageSize') pageSize: number = 15,
    @Query('conversationId') conversationId: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const { id: user_id } = await this.userService.findUserByUserSub(
        req?.userSub || '',
      );
      if (!user_id) {
        throw new HttpException(
          ERROR_MESSAGES.USER_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      const response = await this.messageService.getMessagesByConversationId({
        pageNo,
        pageSize,
        conversationId,
      });
      res.status(HttpStatus.OK).json({
        message: SUCCESS_MESSAGES.MESSAGES_FETCHED_SUCCESS,
        data: response,
      });
    } catch (error) {
      throw error;
    }
  }

  @Delete(':id')
  async deleteMessage(
    @Param('id') id: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const { id: user_id } = await this.userService.findUserByUserSub(
        req?.userSub || '',
      );
      if (!user_id) {
        throw new HttpException(
          ERROR_MESSAGES.USER_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      const response = await this.messageService.deleteMessage(id, user_id);
      res.status(HttpStatus.OK).json({
        message: SUCCESS_MESSAGES.MESSAGE_DELETED_SUCCESS,
        data: response,
      });
    } catch (error) {
      throw error;
    }
  }
}
