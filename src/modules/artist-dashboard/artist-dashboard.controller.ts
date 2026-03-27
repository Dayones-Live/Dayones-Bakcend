import { Controller, Get, Req, Res, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Role } from '@app/modules/auth/decorators/roles.decorator';
import { Roles } from '@app/shared/constants/constants';
import { ArtistDashboardService } from './artist-dashboard.service';

@ApiTags('Artist Dashboard')
@Controller('artist-dashboard')
export class ArtistDashboardController {
  private readonly logger = new Logger(ArtistDashboardController.name);

  constructor(private dashboardService: ArtistDashboardService) {}

  @Get('stats')
  @Role(Roles.ARTIST)
  async getStats(@Req() req: Request, @Res() res: Response) {
    try {
      const userId = req?.user?.id || '';
      const result = await this.dashboardService.getStats(userId);
      res.status(HttpStatus.OK).json({ data: result });
    } catch (error) {
      this.logger.error(`Dashboard stats error: ${error.message}`);
      throw error;
    }
  }
}
