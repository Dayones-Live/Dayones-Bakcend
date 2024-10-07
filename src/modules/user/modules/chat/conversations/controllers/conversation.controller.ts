import { ApiTags } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { CreateConversationInput } from '../dto/types';
import { UserService } from '@user/services/user.service';
import { CognitoGuard } from '@auth/guards/aws.cognito.guard';
import { ConversationService } from '../services/conversation.service';
import {
  ERROR_MESSAGES,
  Roles,
  SUCCESS_MESSAGES,
} from '@app/shared/constants/constants';
import {
  Get,
  Body,
  Req,
  Res,
  Post,
  Param,
  Query,
  Delete,
  UseGuards,
  Controller,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Role } from '@app/modules/auth/decorators/roles.decorator';

@ApiTags('conversation')
@Controller('conversation')
@UseGuards(CognitoGuard)
export class ConversationController {
  constructor(
    private conversationService: ConversationService,
    private userService: UserService,
  ) {}

  /**
   * Creates a new conversation for the authenticated user.
   *
   * @param createConversationInput - The input data for creating a new conversation.
   * @param res - The Express Response object.
   * @param req - The Express Request object containing the user's authentication information.
   * @returns A Promise that resolves to the created conversation data.
   * @throws HttpException if the user is not found.
   */
  @Post()
  @Role(Roles.ARTIST)
  async createConversation(
    @Body() createConversationInput: CreateConversationInput,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const response = await this.conversationService.createConversation(
        req?.user?.id || '',
        createConversationInput,
      );
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.CONVERSATION_CREATED_SUCCESS,
        data: response,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Retrieves all conversations for the authenticated user with pagination.
   *
   * @param pageNo - The page number for pagination (default: 1).
   * @param pageSize - The number of items per page (default: 10).
   * @param res - The Express Response object.
   * @param req - The Express Request object containing the user's authentication information.
   * @returns A Promise that resolves to the paginated list of conversations.
   * @throws HttpException if the user is not found.
   */
  @Get()
  async getAllConversations(
    @Query('pageNo') pageNo: number = 1,
    @Query('pageSize') pageSize: number = 10,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const response = await this.conversationService.fetchAllConversations(
        { pageNo, pageSize },
        req?.user?.id || '',
      );
      res.status(HttpStatus.OK).json({
        message: SUCCESS_MESSAGES.CONVERSATION_FETCHED_SUCCESS,
        data: response,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Deletes a specific conversation for the authenticated user.
   *
   * @param id - The ID of the conversation to be deleted.
   * @param res - The Express Response object.
   * @param req - The Express Request object containing the user's authentication information.
   * @returns A Promise that resolves to the deleted conversation data.
   * @throws HttpException if the user is not found.
   */
  @Delete(':id')
  @Role(Roles.ARTIST)
  async deleteConversation(
    @Param('id') id: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const response = await this.conversationService.deleteConversation(id);
      res.status(HttpStatus.OK).json({
        message: SUCCESS_MESSAGES.CONVERSATION_DELETED_SUCCESS,
        data: response,
      });
    } catch (error) {
      throw error;
    }
  }

  @Get(':id')
  async getConversationDetail(
    @Param('id') id: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      const response = await this.conversationService.getConversationDetails(
        id,
        req?.user?.id || '',
      );
      res.status(HttpStatus.OK).json({
        message: SUCCESS_MESSAGES.CONVERSATION_DELETED_SUCCESS,
        data: response,
      });
    } catch (error) {
      throw error;
    }
  }
}
