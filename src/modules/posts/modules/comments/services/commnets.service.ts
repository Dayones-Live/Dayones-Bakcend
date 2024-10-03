import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Comments } from '../entities/comments.entity';
import { CommentsMapper } from '../dto/comments.mapper';
import { CreateCommentInput, UpdateCommentInput } from '../dto/types';
import { ArtistPostUserService } from '../../artist-post-user/services/artist-post-user.service';
import { User } from '@user/entities/user.entity';
import { Invite_Status } from '../../artist-post-user/constants/constants';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comments)
    private commentsRepository: Repository<Comments>,
    private commentsMapper: CommentsMapper,
    private artistPostUserService: ArtistPostUserService,
  ) {}

  /**
   * Service to create a new Comment
   * @param Create Comment
   * @returns {Comments}
   */
  async commentAPost(
    createCommentInput: CreateCommentInput,
    postId: string,
    userId: string,
  ): Promise<Comments> {
    try {
      // Fetch the artistPostUserId through user id and artistPost
      const artistPostUser =
        await this.artistPostUserService.getArtistPostByPostId(userId, postId);
      if (artistPostUser.status !== Invite_Status.ACCEPTED) {
        throw new HttpException(
          `Not Allowed to comment on post user has not accepted the post invite`,
          HttpStatus.FORBIDDEN,
        );
      }
      createCommentInput.artistPostUserId = artistPostUser?.id;
      const commentDto = this.commentsMapper.dtoToEntity(createCommentInput);
      // Use the upsert method
      const comment = await this.commentsRepository.save(commentDto);
      return comment;
    } catch (error) {
      console.error(
        '🚀 ~ file:comment.service.ts:96 ~ CommentsService ~ createComment ~ error:',
        error,
      );
      throw new HttpException(` ${error?.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Service to update the Comment
   * @param updateArtistPostUserInput
   * @returns {ArtistPost}
   */
  async updateComment(
    updateCommentInput: UpdateCommentInput,
  ): Promise<Comments> {
    try {
      // Fetch the existing post based on id and user_id
      const existingComment = await this.commentsRepository.findOne({
        where: {
          id: updateCommentInput.id,
        },
      });
      // If no post is found, throw an error
      if (!existingComment) {
        throw new HttpException(`Comment not found`, HttpStatus.NOT_FOUND);
      }
      const commentUpdateDto = this.commentsMapper.dtoToEntityUpdate(
        existingComment,
        updateCommentInput,
      );
      // Update the post using save (this will update only the changed fields)
      const updatedComment =
        await this.commentsRepository.save(commentUpdateDto);
      // Exclude user_id and cast the result to exclude TypeORM methods
      return updatedComment;
    } catch (error) {
      console.error(
        '🚀 ~ file:comments.service.ts:96 ~ CommentsService ~ updateComment ~ error:',
        error,
      );
      throw new HttpException(` ${error?.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Service to delete the Comment
   * @param id
   * @returns {boolean}
   */
  async deleteCommentById(
    id: string,
    postId: string,
    user: User,
  ): Promise<boolean> {
    try {
      const artistPostUser =
        await this.artistPostUserService.getArtistPostByPostId(
          user?.id,
          postId,
        );
      // Delete the signature based on both id and user_id
      const deleteResult = await this.commentsRepository.delete({
        id: id,
        artist_post_user_id: artistPostUser.id,
      });
      // Check if any rows were affected (i.e., deleted)
      if (deleteResult.affected === 0) {
        throw new HttpException(
          `Comment not found or already deleted`,
          HttpStatus.NOT_FOUND,
        );
      }
      return true;
    } catch (err) {
      console.error(
        '🚀 ~ file:comments.service.ts:96 ~ CommentsService ~ deleteCommentById ~ error:',
        err,
      );
      throw err;
    }
  }
}
