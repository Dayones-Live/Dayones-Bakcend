import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CommentReactions } from '../entities/comment-reaction.entity';
import { CommentReactionInput } from '../dto/types';
import { ERROR_MESSAGES, Roles } from '@app/shared/constants/constants';
import { CommentReactionMapper } from '../dto/comment-reaction.mapper';
import { CommentsService } from '../../comments/services/commnets.service';
import { User } from '@app/modules/user/entities/user.entity';
import { NOTIFICATION_TITLE, NOTIFICATION_TYPE } from '@app/modules/user/modules/notifications/constants';
import { Notifications } from '@app/modules/user/modules/notifications/entities/notifications.entity';
import { PushNotificationService } from '@app/shared/services/push-notification.service';
import { UserDeviceService } from '@app/modules/user/services/user-device.service';

@Injectable()
export class CommentReactionsService {
  private readonly logger = new Logger(CommentReactionsService.name);

  constructor(
    @InjectRepository(CommentReactions)
    private commentReactionRepository: Repository<CommentReactions>,
    @InjectRepository(Notifications)
    private notificationsRepository: Repository<Notifications>,
    private commentReactionMapper: CommentReactionMapper,
    private commentsService: CommentsService,
    private pushNotificationService: PushNotificationService,
    private userDeviceService: UserDeviceService,
  ) {}

  /**
   * Service to like a Comment
   * @params Like A Comment
   * @returns {CommentReactions}
   */
  async likeAComment(
    createCommentReactionInput: CommentReactionInput,
    user: User,
  ): Promise<CommentReactions> {
    try {
      this.logger.log(`[COMMENT_LIKE] Starting like process for comment ${createCommentReactionInput.commentId} by user ${user.id}`);
      
      const comment = await this.commentsService.getCommentDetails(
        createCommentReactionInput?.commentId,
        createCommentReactionInput?.likedBy,
        user,
      );
      this.logger.log(`[COMMENT_LIKE] Found comment: ${JSON.stringify({
        id: comment.id,
        commentBy: comment.comment_by,
        postId: comment.artistPostUser?.artist_post_id
      })}`);

      const existingCommentLike = await this.commentReactionRepository.findOne({
        where: {
          liked_by: createCommentReactionInput.likedBy,
          comment_id: createCommentReactionInput.commentId,
        },
      });
      if (existingCommentLike) {
        this.logger.warn(`[COMMENT_LIKE] Comment already liked by user ${user.id}`);
        throw new HttpException(
          ERROR_MESSAGES.COMMENT_ALREADY_LIKED_BY_USER,
          HttpStatus.CONFLICT,
        );
      }
      const likeACommentDto = this.commentReactionMapper.dtoToEntity(
        createCommentReactionInput,
      );

      // Get the comment owner's information
      const commentOwner = await this.commentsService.getCommentOwner(createCommentReactionInput.commentId);
      this.logger.log(`[COMMENT_LIKE] Comment owner: ${JSON.stringify({
        id: commentOwner.id,
        role: commentOwner.role
      })}`);
      
      // Check roles for notification logic
      const isLikerArtist = user.role?.includes(Roles.ARTIST);
      const isCommentOwnerArtist = commentOwner?.role?.includes(Roles.ARTIST);
      this.logger.log(`[COMMENT_LIKE] Roles - Liker is artist: ${isLikerArtist}, Comment owner is artist: ${isCommentOwnerArtist}`);

      // Send notification if:
      // 1. Fan likes artist's comment
      // 2. Artist likes fan's comment
      if ((!isLikerArtist && isCommentOwnerArtist) || (isLikerArtist && !isCommentOwnerArtist)) {
        this.logger.log(`[COMMENT_LIKE] Creating notification for comment owner ${commentOwner.id}`);
        
        // Create notification
        const notification = new Notifications();
        notification.to_id = comment?.comment_by || comment?.artistPostUser?.user_id;
        notification.is_read = false;
        notification.from_id = user?.id;
        notification.title = NOTIFICATION_TITLE.LIKE_COMMENT;
        notification.data = JSON.stringify({
          ...likeACommentDto,
          post_id: comment?.artistPostUser?.artist_post_id
        });
        notification.message = `${user.full_name} liked your comment`;
        notification.type = NOTIFICATION_TYPE.REACTION;
        notification.post_id = comment?.artistPostUser?.artist_post_id;
        
        const savedNotification = await this.notificationsRepository.save(notification);
        this.logger.log(`[COMMENT_LIKE] Saved notification with ID: ${savedNotification.id}`);

        // Get active OneSignal player IDs for the recipient
        const playerIds = await this.userDeviceService.getActivePlayerIds(notification.to_id);
        this.logger.log(`[COMMENT_LIKE] Found ${playerIds.length} active devices for recipient ${notification.to_id}`);
        
        // Skip if the recipient is the same as the liker
        if (notification.to_id === user.id) {
          this.logger.log(`[COMMENT_LIKE] Skipping notification for liker ${user.id} (comment owner)`);
        } else if (playerIds.length > 0) {
          this.logger.log(`[COMMENT_LIKE] Sending push notification to ${notification.to_id} with player IDs: ${playerIds.join(', ')}`);
          await this.pushNotificationService.sendPushNotification(
            playerIds,
            notification.title,
            notification.message,
            {
              type: notification.type,
              post_id: notification.post_id,
              notification_id: savedNotification.id
            }
          );
          this.logger.log(`[COMMENT_LIKE] Successfully sent push notification to ${notification.to_id}`);
        } else {
          this.logger.warn(`[COMMENT_LIKE] No active devices found for recipient ${notification.to_id}`);
        }
      } else {
        this.logger.log(`[COMMENT_LIKE] Skipping notification - same role interaction`);
      }

      const savedReaction = await this.commentReactionRepository.save(likeACommentDto);
      this.logger.log(`[COMMENT_LIKE] Saved reaction with ID: ${savedReaction.id}`);
      return savedReaction;
    } catch (error) {
      this.logger.error(`[COMMENT_LIKE] Error in likeAComment: ${error.message}`, error.stack);
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
