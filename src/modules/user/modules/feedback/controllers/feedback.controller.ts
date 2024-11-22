import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response, Request } from 'express';

import { Roles, SUCCESS_MESSAGES } from '@app/shared/constants/constants';
import { Role } from '@app/modules/auth/decorators/roles.decorator';
import { CognitoGuard } from '@app/modules/auth/guards/aws.cognito.guard';
import { SaveFeedbackInput } from '../dto/types';
import { FeedbackService } from '../services/feedback.service';

@Controller('feedback')
export class FeedbackController {
  constructor(private feedbackService: FeedbackService) {}

  @UseGuards(CognitoGuard)
  @Post()
  async saveFeedback(
    @Body() saveFeedbackInput: SaveFeedbackInput,
    @Res()
    res: Response,
    @Req() req: Request,
  ) {
    try {
      saveFeedbackInput.feedbackBy = req?.user?.id || '';
      const feedback =
        await this.feedbackService.saveFeedback(saveFeedbackInput);
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.FEEDBACK_SAVED_SUCCESS,
        data: feedback,
      });
    } catch (error) {
      console.error('🚀 ~ FeedbackController ~ saveFeedback ~ error:', error);
      throw error;
    }
  }

  @Role(Roles.SUPER_ADMIN)
  @UseGuards(CognitoGuard)
  @Get()
  async getAllFeedback(
    @Res()
    res: Response,
    @Req() req: Request,
  ) {
    try {
      const feedbacks = await this.feedbackService.fetchAllFeedbacks();
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.FEEDBACK_FETCHED_SUCCESS,
        data: feedbacks,
      });
    } catch (error) {
      console.error('🚀 ~ FeedbackController ~ getAllFeedback ~ error:', error);
      throw error;
    }
  }
}
