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
import { CognitoGuard } from '../../auth/guards/aws.cognito.guard';

import { SUCCESS_MESSAGES } from '@app/shared/constants/constants';
import { UserService } from '@app/modules/user/services/user.service';
import { ReportService } from '../services/report.service';
import { SaveReportInput } from '../dto/types';

@Controller('report')
export class ReportController {
  constructor(
    private userService: UserService,
    private reportService: ReportService,
  ) {}

  @UseGuards(CognitoGuard)
  @Post()
  async saveReport(
    @Body() saveReportInput: SaveReportInput,
    @Res()
    res: Response,
    @Req() req: Request,
  ) {
    try {
      saveReportInput.reportedBy = req?.user?.id || '';
      const newReport = await this.reportService.saveReport(saveReportInput);
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.REPORT_SAVED_SUCCESS,
        data: newReport,
      });
    } catch (error) {
      console.error('🚀 ~ ReportController ~ saveReport ~ error:', error);
      throw error;
    }
  }

  @UseGuards(CognitoGuard)
  @Get()
  async getAllREports(
    @Res()
    res: Response,
    @Req() req: Request,
  ) {
    try {
      const reports = await this.reportService.fetchAllReports();
      res.status(HttpStatus.CREATED).json({
        message: SUCCESS_MESSAGES.REPORTS_FETCHED_SUCCESS,
        data: reports,
      });
    } catch (error) {
      console.error('🚀 ~ ReportController ~ getAllREports ~ error:', error);
      throw error;
    }
  }
}
