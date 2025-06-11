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
import { NotificationService } from '@app/shared/services/notification.service';
import { NOTIFICATION_TYPE } from '@app/modules/user/modules/notifications/constants';
import { ArtistPostUser } from '../../artist-post-user/entities/artist-post-user.entity';
import { Notifications } from '@app/modules/user/modules/notifications/entities/notifications.entity';
import { UserDeviceService } from '@app/modules/user/services/user-device.service';
import { PushNotificationService } from '@app/shared/services/push-notification.service';
import { NOTIFICATION_TITLE } from '@app/modules/user/modules/notifications/constants';
import { NotificationBundlingService } from '@app/shared/services/notification-bundling.service';
import { Logger } from '@nestjs/common';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    @InjectRepository(Comments)
    private commentsRepository: Repository<Comments>,
    @InjectRepository(Notifications)
    private notificationsRepository: Repository<Notifications>,
    private commentsMapper: CommentsMapper,
    private artistPostUserService: ArtistPostUserService,
    private notificationService: NotificationService,
    private userDeviceService: UserDeviceService,
    private pushNotificationService: PushNotificationService,
    @InjectRepository(ArtistPostUser)
    private artistPostUserRepository: Repository<ArtistPostUser>,
    private notificationBundlingService: NotificationBundlingService,
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
      this.logger.log(`[COMMENT] Starting comment process for post ${postId} by user ${userId}`);
      
      let artistPostUser: ArtistPostUser = {} as ArtistPostUser;
      const artistPostUserGeneric =
        await this.artistPostUserService.getGenericArtistPostUserByPostId(
          postId,
        );
      let comment: Comments = {} as Comments;
      
      if (artistPostUserGeneric) {
        this.logger.log(`[COMMENT] Found generic post user for post ${postId}`);
        createCommentInput.artistPostUserId = artistPostUserGeneric?.id;
        if (artistPostUserGeneric.user_id !== userId) {
          createCommentInput.commentBy = userId;
        }
        const commentDto = this.commentsMapper.dtoToEntity(createCommentInput);
        // Use the upsert method
        comment = await this.commentsRepository.save(commentDto);
        this.logger.log(`[COMMENT] Saved comment with ID: ${comment.id} for generic post`);
      } else {
        this.logger.log(`[COMMENT] No generic post found, checking regular post access`);
        // Fetch the artistPostUserId through user id and artistPost
        artistPostUser = await this.artistPostUserService.getArtistPostByPostId(
          userId,
          postId,
        );
        if (!artistPostUser) {
          this.logger.error(`[COMMENT] Post ${postId} not found for user ${userId}`);
          throw new HttpException(
            ERROR_MESSAGES.POST_NOT_FOUND,
            HttpStatus.NOT_FOUND,
          );
        }
        if (
          artistPostUser.status !== Invite_Status.ACCEPTED &&
          artistPostUser?.user?.role[0] !== Roles.ARTIST
        ) {
          this.logger.error(`[COMMENT] User ${userId} does not have access to post ${postId}`);
          throw new HttpException(
            ERROR_MESSAGES.INVITE_NOT_ACCEPTED,
            HttpStatus.FORBIDDEN,
          );
        }
        createCommentInput.artistPostUserId = artistPostUser?.id;
        const commentDto = this.commentsMapper.dtoToEntity(createCommentInput);
        // Use the upsert method
        comment = await this.commentsRepository.save(commentDto);
        this.logger.log(`[COMMENT] Saved comment with ID: ${comment.id} for regular post`);
      }

      // Get the commenter's information
      const commenter = await this.artistPostUserRepository.findOne({
        where: { user_id: userId },
        relations: ['user', 'artistPost']
      });

      if (!commenter) {
        this.logger.error(`[COMMENT] Commenter information not found for user ${userId}`);
        throw new HttpException(
          ERROR_MESSAGES.POST_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }

      // Check if the commenter is an artist
      const isCommenterArtist = commenter?.user?.role?.includes(Roles.ARTIST);
      this.logger.log(`[COMMENT] User ${userId} is artist: ${isCommenterArtist}`);

      if (isCommenterArtist) {
        // If commenter is an artist, notify all fans with access
        const fansWithAccess = await this.artistPostUserService.getFansWithAccessToPost(postId, userId);
        this.logger.log(`[COMMENT] Found ${fansWithAccess.length} fans to notify for post ${postId}`);
        for (const fan of fansWithAccess) {
          // Get active OneSignal player IDs for the fan
          const playerIds = await this.userDeviceService.getActivePlayerIds(fan.user_id);
          
          // Skip if the fan has the same device IDs as the commenter
          const commenterPlayerIds = await this.userDeviceService.getActivePlayerIds(userId);
          const hasCommonDevice = playerIds.some(id => commenterPlayerIds.includes(id));
          if (hasCommonDevice) {
            this.logger.log(`[COMMENT] Skipping notification for fan ${fan.user_id} - same device as commenter`);
            continue;
          }

          // Check if a notification for this comment already exists for this fan
          const existingNotification = await this.notificationsRepository.findOne({
            where: {
              to_id: fan.user_id,
              from_id: userId,
              post_id: postId,
              type: NOTIFICATION_TYPE.COMMENT,
              created_at: new Date(Date.now() - 5 * 60 * 1000) // Within last 5 minutes
            }
          });

          if (existingNotification) {
            this.logger.log(`[COMMENT] Skipping notification for fan ${fan.user_id} - notification already exists`);
            continue;
          }

          this.logger.log(`[COMMENT] Creating notification for fan ${fan.user_id}`);
          const notification = new Notifications();
          notification.to_id = fan.user_id;
          notification.is_read = false;
          notification.from_id = userId;
          notification.title = NOTIFICATION_TITLE.COMMENT;
          notification.data = JSON.stringify({
            message: createCommentInput?.message,
            post_id: postId,
          });
          notification.message = `${commenter.user.full_name} commented on a post`;
          notification.type = NOTIFICATION_TYPE.COMMENT;
          notification.post_id = postId;

          const savedNotification = await this.notificationsRepository.save(notification);
          this.logger.log(`[COMMENT] Saved notification with ID: ${savedNotification.id} for fan ${fan.user_id}`);

          if (playerIds.length > 0) {
            this.logger.log(`[COMMENT] Sending push notification to fan ${fan.user_id} with player IDs: ${playerIds.join(', ')}`);
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
            this.logger.log(`[COMMENT] Successfully sent push notification to fan ${fan.user_id}`);
          } else {
            this.logger.warn(`[COMMENT] No active devices found for fan ${fan.user_id}`);
          }
        }
      } else {
        // If commenter is a fan, only notify the post owner (artist)
        const postOwnerId = await this.artistPostUserService.getPostOwnerId(postId);
        this.logger.log(`[COMMENT] Post owner ID: ${postOwnerId}`);

        // Skip if the post owner is the same as the commenter
        if (postOwnerId === userId) {
          this.logger.log(`[COMMENT] Skipping notification for commenter ${userId} (post owner)`);
        } else {
          // Get active OneSignal player IDs for the artist
          const playerIds = await this.userDeviceService.getActivePlayerIds(postOwnerId);
          
          if (playerIds.length > 0) {
            this.logger.log(`[COMMENT] Creating notification for artist ${postOwnerId}`);
            const notification = new Notifications();
            notification.to_id = postOwnerId;
            notification.is_read = false;
            notification.from_id = userId;
            notification.title = NOTIFICATION_TITLE.COMMENT;
            notification.data = JSON.stringify({
              message: createCommentInput?.message,
              post_id: postId,
            });
            notification.message = `${commenter.user.full_name} commented on your post`;
            notification.type = NOTIFICATION_TYPE.COMMENT;
            notification.post_id = postId;

            const savedNotification = await this.notificationsRepository.save(notification);
            this.logger.log(`[COMMENT] Saved notification with ID: ${savedNotification.id} for artist ${postOwnerId}`);

            this.logger.log(`[COMMENT] Sending push notification to artist ${postOwnerId} with player IDs: ${playerIds.join(', ')}`);
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
            this.logger.log(`[COMMENT] Successfully sent push notification to artist ${postOwnerId}`);
          } else {
            this.logger.warn(`[COMMENT] No active devices found for artist ${postOwnerId}`);
          }
        }
      }

      return comment;
    } catch (error) {
      this.logger.error(`[COMMENT] Error in commentAPost: ${error.message}`, error.stack);
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

  private isCommentOwnedByUser(
    comment: Comments,
    userId: string,
    user?: User,
  ): boolean {
    if (comment?.artistPostUser?.status === Invite_Status.GENERIC) {
      return user?.role?.includes(Roles.ARTIST)
        ? !comment.comment_by
        : comment.comment_by === userId;
    }
    return comment.artistPostUser.user_id === userId;
  }

  /**
   * Service to fetch the comment by Id and verify that the comment is not of logged in user
   * @param id
   * @returns {Comments}
   */
  async getCommentDetails(
    id: string,
    userId: string,
    user?: User,
  ): Promise<Comments> {
    try {
      const comment = await this.commentsRepository
        .createQueryBuilder('comment')
        .leftJoinAndSelect('comment.artistPostUser', 'artistPostUser')
        .where('comment.id = :id', { id })
        .getOne();
      if (!comment) {
        throw new HttpException(
          ERROR_MESSAGES.COMMENT_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }

      if (this.isCommentOwnedByUser(comment, userId, user)) {
        throw new HttpException(
          ERROR_MESSAGES.COMMENT_OR_REPLY_NOT_BE_SELF_LIKE,
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

  async getCommentOwner(commentId: string): Promise<User> {
    const comment = await this.commentsRepository.findOne({
      where: { id: commentId },
      relations: ['artistPostUser', 'artistPostUser.user']
    });

    if (!comment) {
      throw new HttpException(
        ERROR_MESSAGES.COMMENT_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    return comment.artistPostUser?.user;
  }
}
