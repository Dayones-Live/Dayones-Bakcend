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
    const repliesMap: Record<string, CommentsWithUserResponse[]> = {};
    let associate_fan_count = 0; // Initialize fan count

    if (!artistPosts) {
      return {
        post: {} as ArtistPost,
        reactions: userReactions,
        comments: userComments,
        artistComments,
        associate_fan_count, // Return fan count as 0
      };
    }

    artistPosts.artistPostUser?.forEach((userPost: ArtistPostUser) => {
      // Count reactions if they exist
      if (userPost.reaction && userPost?.status !== Invite_Status.GENERIC) {
        totalReactions += 1;
      } else {
        totalReactions = userPost?.reaction?.length || 0;
      }

      // Count fans based on accepted status
    if (userPost.status === Invite_Status.ACCEPTED) {
      associate_fan_count += 1;
    }

      const { role, ...userWithoutRole } = userPost.user;

      // Handle reactions
      if (userPost?.reaction) {
        userReactions =
          userPost?.reaction as unknown as ReactionsWithUserResponse[];
      }

      // Process comments
      userPost.comment?.forEach((comment: Comments) => {
        const commentReactionCount = comment.commentReaction?.length || 0;
        const { commentReaction, user: commentedUser, ...rest } = comment;

        // Construct comment object
        const commentWithDetails = {
          ...rest,
          commentReaction:
            commentReaction?.map((reaction) => reaction.liked_by) || [],
          commentReactionCount,
          user:
            userPost?.status === Invite_Status.GENERIC && comment?.comment_by
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
          if (userPost?.user?.role[0] === Roles.USER || comment?.comment_by) {
            userComments.push(commentWithDetails);
          } else if (userPost?.user?.role[0] === Roles.ARTIST) {
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

    const { artistPostUser, ...artistPostWithoutUsers } = artistPosts;
    return {
      post: artistPostWithoutUsers,
      comments: userComments,
      artistComments,
      reactions: userReactions,
      associate_fan_count, // Include fan count in the response
    };
  }

  processArtistPostsData(artistPosts: ArtistPost[]): ArtistPostWithCounts[] {
    return artistPosts.map((artistPost) => {
      let commentsCount = 0;
      let totalReactions = 0;
      let associate_fan_count = 0; // Initialize fan count

      artistPost.artistPostUser?.forEach((userPost: ArtistPostUser) => {
        // Count reactions if they exist
        if (userPost?.reaction && userPost?.status !== Invite_Status.GENERIC) {
          totalReactions = totalReactions + userPost?.reaction?.length || 0;
        } else {
          totalReactions = userPost?.reaction?.length || 0;
        }
        commentsCount +=
          userPost.comment?.filter((item) => !item?.parent_comment_id)
            ?.length || 0;

          // Increment fan count for users who accepted invites
          if (userPost?.status === Invite_Status.ACCEPTED) {
            associate_fan_count++;
          }
      });
      // Destructure artistPost and add commentsCount, reactionCount and fanCount
      const { artistPostUser, ...rest } = artistPost;
      console.log('artistPostUser', artistPostUser);
      
      return {
        ...rest,
        commentsCount, // Total comments count (user + artist)
        reactionCount: totalReactions, // Total reactions count
        associate_fan_count, // Total fan count
      };
    });
  }
}
