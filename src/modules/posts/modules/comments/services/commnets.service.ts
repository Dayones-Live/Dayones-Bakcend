import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Comments } from '../entities/comments.entity';
import { CommentsMapper } from '../dto/comments.mapper';
import { CreateCommentInput, UpdateCommentInput } from '../dto/types';
import { ArtistPostUserService } from '../../artist-post-user/services/artist-post-user.service';

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
  async createComment(
    createCommentInput: CreateCommentInput,
    postId: string,
    userId: string,
  ): Promise<Comments> {
    try {
      // Fetch the artistPostUserId through user id and artistPost
      const artistPostUser =
        await this.artistPostUserService.getArtistPostByPostId(userId, postId);
      createCommentInput.artistPostUserId = artistPostUser?.id;
      const dto = this.commentsMapper.dtoToEntity(createCommentInput);
      // Use the upsert method
      const comment = await this.commentsRepository.save(dto);
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
      const updateDto = this.commentsMapper.dtoToEntityUpdate(
        existingComment,
        updateCommentInput,
      );
      // Update the post using save (this will update only the changed fields)
      const updateComment = await this.commentsRepository.save(updateDto);
      // Exclude user_id and cast the result to exclude TypeORM methods
      return updateComment;
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
  async deleteCommentById(id: string): Promise<boolean> {
    try {
      // Delete the signature based on both id and user_id
      const deleteResult = await this.commentsRepository.delete({
        id: id,
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
