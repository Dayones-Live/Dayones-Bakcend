import { mapInputToEntity } from '@app/shared/utils';
import { SaveFeedbackInput } from './types';
import { Feedback } from '../entitites/feedback.entity';

export class FeedbackMapper {
  dtoToEntity(saveFeedbackInput: SaveFeedbackInput): Feedback {
    const updateRecord: boolean = false;
    return mapInputToEntity(new Feedback(), saveFeedbackInput, updateRecord);
  }
}
