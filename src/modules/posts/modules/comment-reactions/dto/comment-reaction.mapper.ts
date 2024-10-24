import { mapInputToEntity } from '@app/shared/utils';
import { CommentReactions } from '../entities/comment-reaction.entity';
import { CommentReactionInput } from './types';

export class CommentReactionMapper {
  dtoToEntity(
    createCommentReactionInput: CommentReactionInput,
  ): CommentReactions {
    const updateRecord: boolean = false;
    return mapInputToEntity(
      new CommentReactions(),
      createCommentReactionInput,
      updateRecord,
    );
  }
}
