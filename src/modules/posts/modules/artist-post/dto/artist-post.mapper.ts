import { mapInputToEntity } from '@app/shared/utils';
import {
  ArtistPostWithCounts,
  CreateArtistPostInput,
  CreateGenericArtistPostInput,
  UpdateArtistPostInput,
} from './types';
import { ArtistPost } from '../entities/artist-post.entity';
import { Comments } from '../../comments/entities/comments.entity';
import { Roles } from '@app/shared/constants/constants';
import {
  CommentsWithUserResponse,
  ReactionsWithUserResponse,
} from '../../artist-post-user/dto/types';
import { Invite_Status } from '../../artist-post-user/constants/constants';
import { ArtistPostUser } from '../../artist-post-user/entities/artist-post-user.entity';

export class ArtistPostMapper {
  dtoToEntity(createArtistPostInput: CreateArtistPostInput): ArtistPost {
    const updateRecord: boolean = false;
    return mapInputToEntity(
      new ArtistPost(),
      createArtistPostInput,
      updateRecord,
    );
  }

  dtoToEntityGenericMessage(
    createGenericArtistPostInput: CreateGenericArtistPostInput,
  ): ArtistPost {
    const updateRecord: boolean = false;
    return mapInputToEntity(
      new ArtistPost(),
      createGenericArtistPostInput,
      updateRecord,
    );
  }

  dtoToEntityUpdate(
    existingArtistPost: ArtistPost,
    updateArtistPost: UpdateArtistPostInput,
  ): ArtistPost {
    const updateRecord: boolean = true;
    return mapInputToEntity(existingArtistPost, updateArtistPost, updateRecord);
  }

  processArtistPostData(artistPosts: ArtistPost) {
    const userComments: CommentsWithUserResponse[] = [];
    const artistComments: CommentsWithUserResponse[] = [];
    let userReactions: ReactionsWithUserResponse[] = [];
    let totalReactions = 0;

    if (!artistPosts) {
      return {
        post: {} as ArtistPost,
        reaction: userReactions,
        comments: userComments,
        artistComments,
      };
    }

    artistPosts.artistPostUser?.forEach((userPost: ArtistPostUser) => {
      // Count reactions if they exist
      if (userPost.reaction && userPost?.status !== Invite_Status.GENERIC) {
        totalReactions += 1;
      } else {
        totalReactions = userPost?.reaction?.length || 0;
      }
      const { role, ...userWithoutRole } = userPost.user;

      // Handle reaction user if exists
      if (userPost?.reaction) {
        userReactions =
          userPost?.reaction as unknown as ReactionsWithUserResponse[];
      }
      // Process comments and count comment reactions
      userPost.comment?.forEach((comment: Comments) => {
        // Count the comment reactions
        const commentReactionCount = comment.commentReaction?.length || 0;
        const { commentReaction, user: commentedUser, ...rest } = comment;
        // Add commentReactionCount to the comment object
        const commentWithReactionCount = {
          ...rest,
          commentReaction:
            commentReaction?.map((reaction) => reaction.liked_by) || [],
          commentReactionCount,
          user:
            userPost?.status === Invite_Status.GENERIC && comment?.comment_by
              ? commentedUser
              : userWithoutRole,
        };

        if (userPost?.user?.role[0] === Roles.USER || comment?.comment_by) {
          userComments.push(commentWithReactionCount); // Include user info in the comment
        } else if (userPost?.user?.role[0] === Roles.ARTIST) {
          artistComments.push(commentWithReactionCount); // Include user info in the comment
        }
      });
    });
    const { artistPostUser, ...artistPostWithoutUsers } = artistPosts;
    return {
      post: artistPostWithoutUsers,
      comments: userComments,
      artistComments: artistComments,
      reactions: userReactions,
    };
  }
  processArtistPostsData(artistPosts: ArtistPost[]): ArtistPostWithCounts[] {
    return artistPosts.map((artistPost) => {
      let commentsCount = 0;
      let totalReactions = 0;
      artistPost.artistPostUser?.forEach((userPost: ArtistPostUser) => {
        // Count reactions if they exist
        if (userPost?.reaction && userPost?.status !== Invite_Status.GENERIC) {
          totalReactions = totalReactions + userPost?.reaction?.length || 0;
        } else {
          totalReactions = userPost?.reaction?.length || 0;
        }
        commentsCount += userPost.comment?.length || 0;
      });
      // Destructure artistPost and add commentsCount and reactionCount
      const { artistPostUser, ...rest } = artistPost;
      return {
        ...rest,
        commentsCount, // Total comments count (user + artist)
        reactionCount: totalReactions, // Total reactions count
      };
    });
  }
}
