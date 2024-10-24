import { mapInputToEntity } from '@app/shared/utils';
import { ArtistPostUser } from '../entities/artist-post-user.entity';
import {
  CommentsWithUserResponse,
  CreateArtistPostUserInput,
  ReactionsWithUserResponse,
  UpdateArtistPostUserInput,
  UserInvitesResponse,
} from './types';
import { Comments } from '../../comments/entities/comments.entity';
import { Roles } from '@app/shared/constants/constants';
import { ArtistPost } from '@app/modules/posts/modules/artist-post/entities/artist-post.entity';

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

  processArtistValidInvites(artistValidInvites?: ArtistPostUser[]) {
    let isReacted = 0;
    const userComments: CommentsWithUserResponse[] = [];
    const artistComments: CommentsWithUserResponse[] = [];
    const userReactions: ReactionsWithUserResponse[] = [];

    if (!artistValidInvites || artistValidInvites.length === 0) {
      return {
        post: {} as ArtistPost,
        reaction: userReactions,
        comments: userComments,
        artistComments,
      };
    }

    // Iterate over the array
    artistValidInvites.forEach((invite) => {
      // Set reaction from the first record
      isReacted =
        invite?.user?.role[0] === Roles.USER && invite?.reaction ? 1 : 0;
      const { role, ...userWithoutRole } = invite?.user;

      // Handle reaction user if exists
      if (invite?.reaction) {
        userReactions.push({ ...invite.reaction, user: userWithoutRole });
      }
      invite?.comment?.forEach((comment: Comments) => {
        const commentReactionCount = comment.commentReaction?.length || 0;
        const { commentReaction, ...rest } = comment;
        const commentWithReactionCount = {
          ...rest,
          commentReaction:
            commentReaction?.map((reaction) => reaction.liked_by) || [],
          commentReactionCount,
          user: userWithoutRole,
        };
        if (invite?.user?.role[0] === Roles.USER) {
          userComments.push(commentWithReactionCount); // Include user info in the comment
        } else if (invite?.user?.role[0] === Roles.ARTIST) {
          artistComments.push(commentWithReactionCount); // Include user info in the comment
        }
      });
    });

    return {
      post: artistValidInvites[0].artistPost,
      reactions: userReactions,
      comments: userComments, // All comments where the user is a USER
      artistComments,
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
