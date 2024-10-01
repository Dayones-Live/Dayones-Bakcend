import { mapInputToEntity } from '@app/shared/utils';
import { CreateUserSignatureInput } from './types';
import { Signatures } from '../entities/signature.entity';

export class SignatureMapper {
  dtoToEntity(createUserSignatureInput: CreateUserSignatureInput): Signatures {
    const updateRecord: boolean = false;
    return mapInputToEntity(
      new Signatures(),
      createUserSignatureInput,
      updateRecord,
    );
  }
}
