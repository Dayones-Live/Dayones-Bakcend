import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feedback } from '../entitites/feedback.entity';
import { FeedbackMapper } from '../dto/feedback.mapper';
import { SaveFeedbackInput } from '../dto/types';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(Feedback)
    private feedbackRepository: Repository<Feedback>,
    private feedBackMapper: FeedbackMapper,
  ) {}

  async saveFeedback(saveFeedbackInput: SaveFeedbackInput): Promise<Feedback> {
    try {
      const reportDto = this.feedBackMapper.dtoToEntity(saveFeedbackInput);
      const response = await this.feedbackRepository.save(reportDto);
      return response;
    } catch (error) {
      console.error(
        '🚀 ~ file:feedback.service.ts:96 ~ Feedback ~ saveFeedback ~ error:',
        error,
      );
      throw new HttpException(` ${error?.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Service to fetch all feedbacks
   * @returns {Feedback[]}
   */
  async fetchAllFeedbacks(): Promise<Feedback[]> {
    try {
      const reports = this.feedbackRepository
        .createQueryBuilder('feedback')
        .leftJoin('feedback.user', 'user')
        .addSelect([
          'user.id',
          'user.full_name',
          'user.email',
          'user.phone_number',
          'user.latitude',
          'user.longitude',
          'user.avatar_url',
          'user.phone_number',
        ])
        .getMany();

      return reports;
    } catch (error) {
      console.error(
        '🚀 ~ file:feedback.service.ts:96 ~ fetchAllFeedbacks ~ error:',
        error,
      );
      throw error;
    }
  }
}
