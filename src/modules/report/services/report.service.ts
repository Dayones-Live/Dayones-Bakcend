import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from '../entities/report.entity';
import { SaveReportInput } from '../dto/types';
import { ReportMapper } from '../dto/report.mapper';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Report)
    private reportRepository: Repository<Report>,
    private reportMapper: ReportMapper,
  ) {}

  /**
   * Service to save the user reports against {comment, post, user}
   * @param saveReportInput
   * @returns {Report}
   */
  async saveReport(saveReportInput: SaveReportInput): Promise<Report> {
    try {
      const reportDto = this.reportMapper.dtoToEntity(saveReportInput);
      const response = await this.reportRepository.save(reportDto);
      return response;
    } catch (error) {
      console.error(
        '🚀 ~ file:report.service.ts:96 ~ ReportService ~ saveReport ~ error:',
        error,
      );
      throw new HttpException(` ${error?.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Service to fetch all reports logged by users
   * @returns {Report[]}
   */
  async fetchAllReports(): Promise<Report[]> {
    try {
      const reports = this.reportRepository
        .createQueryBuilder('report')
        .leftJoin('report.reportedBy', 'reportedBy')
        .addSelect([
          'reportedBy.id',
          'reportedBy.full_name',
          'reportedBy.email',
          'reportedBy.phone_number',
          'reportedBy.latitude',
          'reportedBy.longitude',
          'reportedBy.avatar_url',
          'reportedBy.phone_number',
        ])
        .leftJoin('report.reportedUser', 'reportedUser')
        .addSelect([
          'reportedUser.id',
          'reportedUser.full_name',
          'reportedUser.email',
          'reportedUser.phone_number',
          'reportedUser.latitude',
          'reportedUser.longitude',
          'reportedUser.avatar_url',
          'reportedUser.phone_number',
        ])
        .leftJoinAndSelect('report.reportedPost', 'reportedPost')
        .leftJoinAndSelect('report.reportedComment', 'reportedComment')
        .getMany();

      return reports;
    } catch (error) {
      console.error(
        '🚀 ~ file:report.service.ts:96 ~ fetchAllReports ~ error:',
        error,
      );
      throw error;
    }
  }
}
