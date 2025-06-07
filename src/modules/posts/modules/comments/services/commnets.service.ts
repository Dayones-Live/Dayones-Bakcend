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

@Injectable()
export class CommentsService {
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
      const comment = this.commentsMapper.dtoToEntity(createCommentInput);
      const post = await this.artistPostUserService.getArtistPostByPostId(postId, postId);

      if (!post) {
        throw new HttpException(
          ERROR_MESSAGES.POST_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }

      const postOwnerId = post.artistPost?.user_id;

      // Only create and send notification if the commenter is not the post owner
      if (postOwnerId !== userId) {
        // Get the commenter's information
        const commenter = await this.artistPostUserService.getArtistPostByPostId(userId, postId);

        // Check if the post owner is an artist
        const postOwnerUser = await this.artistPostUserService.getArtistPostByPostId(postOwnerId, postId);
        const isArtist = postOwnerUser?.user?.role?.includes(Roles.ARTIST);

        if (isArtist) {
          // For artists, check if we should bundle the notification
          const shouldBundle = await this.notificationBundlingService.shouldBundleNotification(
            postOwnerId,
            postId,
            NOTIFICATION_TYPE.COMMENT
          );

          if (shouldBundle) {
            // Create bundled notification
            const bundledNotification = await this.notificationBundlingService.createBundledNotification(
              postOwnerId,
              postId,
              NOTIFICATION_TYPE.COMMENT
            );

            if (bundledNotification) {
              // Get active OneSignal player IDs for the post owner
              const playerIds = await this.userDeviceService.getActivePlayerIds(postOwnerId);
              
              if (playerIds.length > 0) {
                await this.pushNotificationService.sendPushNotification(
                  playerIds,
                  bundledNotification.title,
                  bundledNotification.message,
                  {
                    type: bundledNotification.type,
                    post_id: bundledNotification.post_id,
                    notification_id: bundledNotification.id,
                    is_bundled: true
                  }
                );
              }
            }
          } else {
            // Create individual notification
            const notification = new Notifications();
            notification.is_read = false;
            notification.from_id = userId;
            notification.post_id = postId;
            notification.title = NOTIFICATION_TITLE.COMMENT;
            notification.type = NOTIFICATION_TYPE.COMMENT;
            notification.data = JSON.stringify({
              message: createCommentInput?.message,
              post_id: postId
            });
            notification.message = `${commenter.user.full_name} just commented`;
            notification.to_id = postOwnerId;

            const savedNotification = await this.notificationsRepository.save(notification);
            
            // Get active OneSignal player IDs for the post owner
            const playerIds = await this.userDeviceService.getActivePlayerIds(postOwnerId);
            
            if (playerIds.length > 0) {
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
            }
          }
        } else {
          // For non-artists, send individual notification
          const notification = new Notifications();
          notification.is_read = false;
          notification.from_id = userId;
          notification.post_id = postId;
          notification.title = NOTIFICATION_TITLE.COMMENT;
          notification.type = NOTIFICATION_TYPE.COMMENT;
          notification.data = JSON.stringify({
            message: createCommentInput?.message,
            post_id: postId
          });
          notification.message = `${commenter.user.full_name} just commented`;
          notification.to_id = postOwnerId;

          const savedNotification = await this.notificationsRepository.save(notification);
          
          const playerIds = await this.userDeviceService.getActivePlayerIds(postOwnerId);
          
          if (playerIds.length > 0) {
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
          }
        }
      }

      return await this.commentsRepository.save(comment);
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
}
