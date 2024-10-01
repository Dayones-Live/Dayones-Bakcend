import { mapInputToEntity } from '@app/shared/utils';
import { CreateReactionInput } from './types';
import { Reactions } from '../entities/reaction.entity';

export class ReactionsMapper {
  dtoToEntity(createReactionInput: CreateReactionInput): Reactions {
    const updateRecord: boolean = false;
    return mapInputToEntity(new Reactions(), createReactionInput, updateRecord);
  }
}
