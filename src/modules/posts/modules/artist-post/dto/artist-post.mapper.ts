import { mapInputToEntity } from '@app/shared/utils';
import { CreateArtistPostInput, UpdateArtistPostInput } from './types';
import { ArtistPost } from '../entities/artist-post.entity';

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
    let totalReactions = 0;
    const userComments =
      artistPosts.artistPostUser?.flatMap((userPost: any) => {
        // Increment total reactions if a reaction exists
        if (userPost.reaction) {
          totalReactions++;
        }
        // Return mapped comment objects with user_id and message
        return (
          userPost?.comment?.map((comment: any) => ({
            userId: userPost.user_id, // User id from artistPostUser
            message: comment.message, // Message from comment
          })) || []
        ); // Handle case where comment is undefined
      }) || []; // Handle case where artistPostUser is undefined
    // Destructure to exclude artistPostUser and return the remaining data
    const { artistPostUser, ...artistPostWithoutUsers } = artistPosts;
    return {
      post: artistPostWithoutUsers,
      comments: userComments,
      reaction: totalReactions,
    };
  }
}
