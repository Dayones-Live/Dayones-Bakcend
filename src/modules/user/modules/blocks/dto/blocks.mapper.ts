import { mapInputToEntity } from '@app/shared/utils';
import { BlockUserInput } from './types';
import { Blocks } from '../entities/blocks.entity';

export class BlocksMapper {
  dtoToEntity(blockUserInput: BlockUserInput): Blocks {
    const updateRecord: boolean = false;
    return mapInputToEntity(new Blocks(), blockUserInput, updateRecord);
  }
}
