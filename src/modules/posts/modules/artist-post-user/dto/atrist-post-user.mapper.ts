import { mapInputToEntity } from '@app/shared/utils';
import { ArtistPostUser } from '../entities/artist-post-user.entity';
import {
  CommentsWithUserResponse,
  CreateArtistPostUserInput,
  UpdateArtistPostUserInput,
  UserInvitesResponse,
} from './types';
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
    const userComments: CommentsWithUserResponse[] = [];
    const artistComments: CommentsWithUserResponse[] = [];
    // Iterate over the array
    artistValidInvites.forEach((invite) => {
      // Set reaction from the first record
      isReacted =
        invite?.user?.role[0] === Roles.USER && invite?.reaction ? 1 : 0;
      const { role, ...userWithoutRole } = invite?.user;
      // Separate comments based on the role
      if (invite.user?.role[0] === 'USER') {
        invite?.comment?.forEach((comment: Comments) => {
          userComments.push({ ...comment, user: userWithoutRole }); // Include user info in the comment
        });
      } else if (invite.user?.role[0] === 'ARTIST') {
        invite?.comment?.forEach((comment: Comments) => {
          artistComments.push({ ...comment, user: userWithoutRole }); // Include user info in the comment
        });
      }
    });

    return {
      post: artistValidInvites[0].artistPost,
      reaction: isReacted,
      comments: userComments, // All comments where the user is a USER
      artistComments, // All comments where the user is an ARTIST
    };
  }

  processInvitesToAddUser(
    artistPostUsers: ArtistPostUser[],
  ): UserInvitesResponse[] {
    return artistPostUsers.map((artistPostUser) => {
      const { artistPost, ...rest } = artistPostUser;
      // Extract the user from artistPost
      const user = artistPost?.user;
      // Construct the new artistPostUser object with user inside
      return {
        ...rest,
        user: user,
      } as UserInvitesResponse;
    });
  }
}
