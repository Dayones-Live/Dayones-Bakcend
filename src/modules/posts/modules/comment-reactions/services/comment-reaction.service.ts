import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CommentReactions } from '../entities/comment-reaction.entity';
import { CommentReactionInput } from '../dto/types';
import { ERROR_MESSAGES } from '@app/shared/constants/constants';
import { CommentReactionMapper } from '../dto/comment-reaction.mapper';
import { CommentsService } from '../../comments/services/commnets.service';

@Injectable()
export class CommentReactionsService {
  constructor(
    @InjectRepository(CommentReactions)
    private commentReactionRepository: Repository<CommentReactions>,
    private commentReactionMapper: CommentReactionMapper,
    private commentsService: CommentsService,
  ) {}

  /**
   * Service to like a Comment
   * @params Like A Comment
   * @returns {CommentReactions}
   */
  async likeAComment(
    createCommentReactionInput: CommentReactionInput,
  ): Promise<CommentReactions> {
    try {
      await this.commentsService.getCommentDetails(
        createCommentReactionInput?.commentId,
        createCommentReactionInput?.likedBy,
      );
      const existingCommentLike = await this.commentReactionRepository.findOne({
        where: {
          liked_by: createCommentReactionInput.likedBy,
          comment_id: createCommentReactionInput.commentId,
        },
      });
      if (existingCommentLike) {
        throw new HttpException(
          ERROR_MESSAGES.COMMENT_ALREADY_LIKED_BY_USER,
          HttpStatus.CONFLICT,
        );
      }
      const likeACommentDto = this.commentReactionMapper.dtoToEntity(
        createCommentReactionInput,
      );
      return await this.commentReactionRepository.save(likeACommentDto);
    } catch (error) {
      console.error(
        '🚀 ~ file:-reactions.service.ts:96 ~ CommentsService ~ createComment ~ error:',
        error,
      );
      throw new HttpException(` ${error?.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Service to dislike a Comment
   * @params Dislike A Comment
   * @returns {CommentReactions}
   */
  async dislikeAComment(
    createCommentReactionInput: CommentReactionInput,
  ): Promise<Boolean> {
    try {
      await this.commentsService.getCommentDetails(
        createCommentReactionInput?.commentId,
        createCommentReactionInput?.likedBy,
      );
      const existingCommentLike = await this.commentReactionRepository.findOne({
        where: {
          liked_by: createCommentReactionInput.likedBy,
          comment_id: createCommentReactionInput.commentId,
        },
      });
      // If it exists, delete the like (dislike the comment)
      if (existingCommentLike) {
        const deleteResult = await this.commentReactionRepository.delete({
          comment_id: createCommentReactionInput.commentId,
          liked_by: createCommentReactionInput.likedBy,
        });
        if (deleteResult.affected === 0) {
          throw new HttpException(
            ERROR_MESSAGES.COMMENT_NOT_FOUND,
            HttpStatus.NOT_FOUND,
          );
        }
        return true; // Or return a response if needed
      }

      // If there's no existing like, return an error or handle accordingly
      throw new HttpException(
        ERROR_MESSAGES.COMMENT_NOT_LIKED_BY_USER,
        HttpStatus.CONFLICT,
      );
    } catch (error) {
      console.error(
        '🚀 ~ file:-reactions.service.ts:96 ~ CommentsService ~ createComment ~ error:',
        error,
      );
      throw new HttpException(` ${error?.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * This service will like all post comments of users
   * @param postId
   * @param userId
   * @returns {Boolean}
   */
  async likeAllPostComments(postId: string, userId: string): Promise<Boolean> {
    try {
      const comments = await this.commentsService.getCommentDetailsByPostId(
        postId,
        userId,
      );
      for (const comment of comments) {
        const existingCommentLike =
          await this.commentReactionRepository.findOne({
            where: {
              liked_by: userId,
              comment_id: comment?.id,
            },
          });
        if (!existingCommentLike) {
          await this.commentReactionRepository.save({
            comment_id: comment?.id,
            liked_by: userId,
          });
        }
      }
      return true;
    } catch (error) {
      console.error(
        '🚀 ~ file:-reactions.service.ts:96 ~ commentReactionService ~ likeAllPostComments ~ error:',
        error,
      );
      throw new HttpException(` ${error?.message}`, HttpStatus.BAD_REQUEST);
    }
  }
}
