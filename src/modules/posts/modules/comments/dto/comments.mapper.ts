import { mapInputToEntity } from '@app/shared/utils';
import { CreateCommentInput, UpdateCommentInput } from './types';
import { Comments } from '../entities/comments.entity';

export class CommentsMapper {
  dtoToEntity(createCommentInput: CreateCommentInput): Comments {
    const updateRecord: boolean = false;
    return mapInputToEntity(new Comments(), createCommentInput, updateRecord);
  }

  dtoToEntityUpdate(
    existingComment: Comments,
    updateComment: UpdateCommentInput,
  ): Comments {
    const updateRecord: boolean = true;
    return mapInputToEntity(existingComment, updateComment, updateRecord);
  }
}
