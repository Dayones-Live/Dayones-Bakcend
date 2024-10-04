import { mapInputToEntity } from '@app/shared/utils';
import { CreateArtistPostInput, UpdateArtistPostInput } from './types';
import { ArtistPost } from '../entities/artist-post.entity';
import { Comments } from '../../comments/entities/comments.entity';

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
    let totalReactions = 0;
    artistPosts.artistPostUser?.forEach((userPost: any) => {
      // Count reactions if they exist
      if (userPost.reaction) {
        totalReactions += 1;
      }
      userPost.comment?.forEach((comment: any) => {
        userComments.push(comment);
      });
    });
    const { artistPostUser, ...artistPostWithoutUsers } = artistPosts;
    return {
      post: artistPostWithoutUsers,
      comments: userComments,
      reaction: totalReactions,
    };
  }
}
