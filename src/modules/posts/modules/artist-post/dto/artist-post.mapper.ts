import { mapInputToEntity } from '@app/shared/utils';
import {
  ArtistPostWithCounts,
  CreateArtistPostInput,
  UpdateArtistPostInput,
} from './types';
import { ArtistPost } from '../entities/artist-post.entity';
import { Comments } from '../../comments/entities/comments.entity';
import { Roles } from '@app/shared/constants/constants';

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
    const userComments: Comments[] = [];
    const artistComments: Comments[] = [];
    let totalReactions = 0;
    artistPosts.artistPostUser?.forEach((userPost: any) => {
      // Count reactions if they exist
      if (userPost.reaction) {
        totalReactions += 1;
      }
      if (userPost?.user?.role[0] === Roles.USER) {
        userPost.comment?.forEach((comment: any) => {
          userComments.push(comment);
        });
      } else if (userPost?.user?.role[0] === Roles.ARTIST) {
        userPost.comment?.forEach((comment: any) => {
          artistComments.push(comment);
        });
      }
    });
    const { artistPostUser, ...artistPostWithoutUsers } = artistPosts;
    return {
      post: artistPostWithoutUsers,
      comments: userComments,
      artistComments: artistComments,
      reaction: totalReactions,
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
