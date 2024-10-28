import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Comments } from '../entities/comments.entity';
import { CommentsMapper } from '../dto/comments.mapper';
import { CreateCommentInput, UpdateCommentInput } from '../dto/types';
import { ArtistPostUserService } from '../../artist-post-user/services/artist-post-user.service';
import { User } from '@user/entities/user.entity';
import { Invite_Status } from '../../artist-post-user/constants/constants';
import { ERROR_MESSAGES, Roles } from '@app/shared/constants/constants';
import { FirebaseService } from '@app/modules/user/modules/ notifications/services/notification.service';
import { NOTIFICATION_TYPE } from '@app/modules/user/modules/ notifications/constants';
import { ArtistPostUser } from '../../artist-post-user/entities/artist-post-user.entity';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comments)
    private commentsRepository: Repository<Comments>,
    private commentsMapper: CommentsMapper,
    private artistPostUserService: ArtistPostUserService,
    @Inject(forwardRef(() => FirebaseService))
    private firebaseService: FirebaseService,
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
      let artistPostUser: ArtistPostUser = {} as ArtistPostUser;
      const artistPostUserGeneric =
        await this.artistPostUserService.getGenericArtistPostUserByPostId(
          postId,
        );
      let comment: Comments = {} as Comments;
      if (artistPostUserGeneric) {
        createCommentInput.artistPostUserId = artistPostUserGeneric?.id;
        const commentDto = this.commentsMapper.dtoToEntity(createCommentInput);
        // Use the upsert method
        comment = await this.commentsRepository.save(commentDto);
      } else {
        // Fetch the artistPostUserId through user id and artistPost
        const artistPostUser =
          await this.artistPostUserService.getArtistPostByPostId(
            userId,
            postId,
          );
        if (!artistPostUser) {
          throw new HttpException(
            ERROR_MESSAGES.POST_NOT_FOUND,
            HttpStatus.NOT_FOUND,
          );
        }
        if (
          artistPostUser.status !== Invite_Status.ACCEPTED &&
          artistPostUser?.user?.role[0] !== Roles.ARTIST
        ) {
          throw new HttpException(
            ERROR_MESSAGES.INVITE_NOT_ACCEPTED,
            HttpStatus.FORBIDDEN,
          );
        }
        createCommentInput.artistPostUserId = artistPostUser?.id;
        const commentDto = this.commentsMapper.dtoToEntity(createCommentInput);
        // Use the upsert method
        comment = await this.commentsRepository.save(commentDto);
      }
      //send and save notification
      try {
        await this.firebaseService.addNotification({
          isRead: false,
          fromId: userId,
          title: 'Comment',
          type: NOTIFICATION_TYPE.COMMENTS,
          data: createCommentInput?.message,
          message: createCommentInput?.message,
          toId:
            artistPostUserGeneric?.artistPost?.user_id ||
            artistPostUser?.artistPost?.user_id,
        });
      } catch (err) {
        console.error('🚀 ~ Sending/Saving Notification ~ err:', err);
      }
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
        throw new HttpException(
          ERROR_MESSAGES.COMMENT_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
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
          ERROR_MESSAGES.COMMENT_NOT_FOUND,
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

  /**
   * Service to fetch the comment by Id and verify that the comment is not of logged in user
   * @param id
   * @returns {Comments}
   */
  async getCommentDetails(id: string, userId: string): Promise<Comments> {
    try {
      const comment = await this.commentsRepository
        .createQueryBuilder('comment')
        .leftJoinAndSelect('comment.artistPostUser', 'artistPostUser')
        .where('comment.id = :id', { id })
        .andWhere('artistPostUser.user_id != :userId', { userId })
        .getOne();
      if (!comment) {
        throw new HttpException(
          ERROR_MESSAGES.COMMENT_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      return comment;
    } catch (error) {
      console.error('🚀 ~ CommentsService ~ getCommentById ~ error:', error);
      throw error;
    }
  }

  /**
   * Get the comments by post id
   * @param id
   * @param userId
   * @returns {Comments[]}
   */
  async getCommentDetailsByPostId(
    id: string,
    userId: string,
  ): Promise<Comments[]> {
    try {
      const comments = await this.commentsRepository
        .createQueryBuilder('comment')
        .leftJoinAndSelect('comment.artistPostUser', 'artistPostUser')
        .leftJoinAndSelect('artistPostUser.artistPost', 'artistPost')
        .where('artistPostUser.artist_post_id = :postId', { postId: id })
        .andWhere('artistPost.user_id = :userId', { userId })
        .andWhere('artistPostUser.status = :status', {
          status: Invite_Status.ACCEPTED,
        })
        .getMany();
      return comments;
    } catch (error) {
      console.error('🚀 ~ CommentsService ~ getCommentById ~ error:', error);
      throw error;
    }
  }
}
