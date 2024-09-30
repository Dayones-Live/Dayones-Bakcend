import { mapInputToEntity } from '@app/shared/utils';
import { ArtistPostUser } from '../entities/artist-post.user.entity';
import { CreateArtistPostUserInput, UpdateArtistPostUserInput } from './types';

export class ArtistPostUserMapper {
  dtoToEntity(
    createArtistPostUserInput: CreateArtistPostUserInput,
  ): ArtistPostUser {
    const updateRecord: boolean = false;
    return mapInputToEntity(
      new ArtistPostUser(),
      createArtistPostUserInput,
      updateRecord,
    );
  }

  dtoToEntityUpdate(
    existingArtistPostUser: ArtistPostUser,
    updateArtistPostUser: UpdateArtistPostUserInput,
  ): ArtistPostUser {
    const updateRecord: boolean = true;
    return mapInputToEntity(
      existingArtistPostUser,
      updateArtistPostUser,
      updateRecord,
    );
  }
}
