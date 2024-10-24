import { mapInputToEntity } from '@app/shared/utils';
import {
  ArtistPostWithCounts,
  CreateArtistPostInput,
  UpdateArtistPostInput,
} from './types';
import { ArtistPost } from '../entities/artist-post.entity';
import { Comments } from '../../comments/entities/comments.entity';
import { Roles } from '@app/shared/constants/constants';
import {
  CommentsWithUserResponse,
  ReactionsWithUserResponse,
} from '../../artist-post-user/dto/types';

export class ArtistPostMapper {
  dtoToEntity(createArtistPostInput: CreateArtistPostInput): ArtistPost {
    const updateRecord: boolean = false;
    return mapInputToEntity(
      new ArtistPost(),
      createArtistPostInput,
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
    const userReactions: ReactionsWithUserResponse[] = [];
    let totalReactions = 0;

    if (!artistPosts) {
      return {
        post: {} as ArtistPost,
        reaction: userReactions,
        comments: userComments,
        artistComments,
      };
    }

    artistPosts.artistPostUser?.forEach((userPost: any) => {
      // Count reactions if they exist
      if (userPost.reaction) {
        totalReactions += 1;
      }
      const { role, ...userWithoutRole } = userPost.user;

      // Handle reaction user if exists
      if (userPost?.reaction) {
        userReactions.push({ ...userPost.reaction, user: userWithoutRole });
      }
      // Process comments and count comment reactions
      userPost.comment?.forEach((comment: Comments) => {
        // Count the comment reactions
        const commentReactionCount = comment.commentReaction?.length || 0;
        const { commentReaction, ...rest } = comment;
        // Add commentReactionCount to the comment object
        const commentWithReactionCount = {
          ...rest,
          commentReactionCount,
          user: userWithoutRole,
        };

        if (userPost?.user?.role[0] === Roles.USER) {
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
      artistPost.artistPostUser?.forEach((userPost: any) => {
        // Count reactions if they exist
        if (userPost.reaction) {
          totalReactions += 1;
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
