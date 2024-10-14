import { mapInputToEntity } from '@app/shared/utils';
import { ArtistPostUser } from '../entities/artist-post-user.entity';
import { CreateArtistPostUserInput, UpdateArtistPostUserInput } from './types';
import { Comments } from '../../comments/entities/comments.entity';
import { Roles } from '@app/shared/constants/constants';

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

  processArtistValidInvites(artistValidInvites: any[]) {
    let isReacted = 0;
    const userComments: Comments[] = [];
    const artistComments: Comments[] = [];
    // Iterate over the array
    artistValidInvites.forEach((invite) => {
      // Set reaction from the first record
      isReacted =
        invite?.user?.role[0] === Roles.USER && invite?.reaction ? 1 : 0;

      // Separate comments based on the role
      if (invite.user?.role[0] === 'USER') {
        userComments.push(...invite.comment);
      } else if (invite.user?.role[0] === 'ARTIST') {
        artistComments.push(...invite.comment);
      }
    });

    return {
      post: artistValidInvites[0].artistPost,
      reaction: isReacted,
      comments: userComments, // All comments where the user is a USER
      artistComments, // All comments where the user is an ARTIST
    };
  }
}
