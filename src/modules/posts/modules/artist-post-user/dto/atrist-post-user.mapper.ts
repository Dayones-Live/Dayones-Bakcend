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
import { Post_Type } from '../../artist-post/constants';
import { Invite_Status } from '../constants/constants';

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
    let userComments: CommentsWithUserResponse[] = [];
    let artistComments: CommentsWithUserResponse[] = [];
    let userReactions: ReactionsWithUserResponse[] = [];
    const repliesMap: Record<string, CommentsWithUserResponse[]> = {};

    if (!artistValidInvites || artistValidInvites.length === 0) {
      return {
        post: {} as ArtistPost,
        reactions: userReactions,
        comments: userComments,
        artistComments,
      };
    }

    artistValidInvites.forEach((invite) => {
      const { role, ...userWithoutRole } = invite?.user;

      // Handle reactions
      if (invite?.reaction && invite?.status === Invite_Status.GENERIC) {
        userReactions =
          invite?.reaction as unknown as ReactionsWithUserResponse[];
      } else if (invite?.reaction?.length > 0) {
        userReactions.push({
          ...invite?.reaction[0],
          user:
            invite?.status === Invite_Status.GENERIC
              ? userWithoutRole
              : invite?.user,
        });
      }

      // Process comments
      invite?.comment?.forEach((comment: Comments) => {
        const commentReactionCount = comment.commentReaction?.length || 0;
        const { commentReaction, user: commentedUser, ...rest } = comment;

        // Construct comment object
        const commentWithDetails = {
          ...rest,

          commentReaction:
            commentReaction?.map((reaction) => reaction.liked_by) || [],

          commentReactionCount,
          user:
            invite?.status === Invite_Status.GENERIC && comment?.comment_by
              ? commentedUser
              : userWithoutRole,
        };

        // Check if the comment is a reply
        if (comment.parent_comment_id) {
          // If it's a reply, add it to the replies map
          repliesMap[comment.parent_comment_id] =
            repliesMap[comment.parent_comment_id] || [];
          repliesMap[comment.parent_comment_id].push(commentWithDetails);
        } else {
          // If it's a top-level comment, push it directly to the appropriate array
          if (invite?.user?.role[0] === Roles.USER || comment?.comment_by) {
            userComments.push(commentWithDetails);
          } else if (invite?.user?.role[0] === Roles.ARTIST) {
            artistComments.push(commentWithDetails);
          }
        }
      });
    });

    // Attach replies to their corresponding parent comments
    userComments.forEach((comment) => {
      comment.replies = repliesMap[comment.id] || []; // Attach replies if any
    });

    artistComments.forEach((comment) => {
      comment.replies = repliesMap[comment.id] || []; // Attach replies if any
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
