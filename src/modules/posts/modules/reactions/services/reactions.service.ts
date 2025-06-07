import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Reactions } from '../entities/reaction.entity';
import { ReactionsMapper } from '../dto/reaction.mapper';
import { CreateReactionInput } from '../dto/types';
import { ArtistPostUserService } from '../../artist-post-user/services/artist-post-user.service';
import { User } from '@app/modules/user/entities/user.entity';
import { Invite_Status } from '../../artist-post-user/constants/constants';
import { ERROR_MESSAGES, Roles } from '@app/shared/constants/constants';
import { NOTIFICATION_TITLE, NOTIFICATION_TYPE } from '@app/modules/user/modules/notifications/constants';
import { ArtistPostUser } from '@app/modules/posts/modules/artist-post-user/entities/artist-post-user.entity';
import { Notifications } from '@app/modules/user/modules/notifications/entities/notifications.entity';
import { PushNotificationService } from '@app/shared/services/push-notification.service';
import { UserDeviceService } from '@app/modules/user/services/user-device.service';
import { ArtistPost } from '@app/modules/posts/modules/artist-post/entities/artist-post.entity';
import { NotificationBundlingService } from '@app/shared/services/notification-bundling.service';

@Injectable()
export class ReactionService {
  private readonly logger = new Logger(ReactionService.name);

  constructor(
    @InjectRepository(Reactions)
    private reactionRepository: Repository<Reactions>,
    @InjectRepository(Notifications)
    private notificationsRepository: Repository<Notifications>,
    @InjectRepository(ArtistPost)
    private artistPostRepository: Repository<ArtistPost>,
    private reactionMapper: ReactionsMapper,
    private artistPostUserService: ArtistPostUserService,
    private pushNotificationService: PushNotificationService,
    private userDeviceService: UserDeviceService,
    private notificationBundlingService: NotificationBundlingService,
  ) {}

  /**
   * Service to create a new Comment
   * @param Creation
   * @returns {Reactions}
   */
  async likeAPost(
    createReactionInput: CreateReactionInput,
    postId: string,
    userId: string,
  ): Promise<Reactions> {
    try {
      // Get the artist post user record first
      const artistPostUser = await this.artistPostUserService.getArtistPostByPostId(userId, postId);
      
      if (!artistPostUser) {
        throw new HttpException(
          'User does not have access to this post',
          HttpStatus.FORBIDDEN
        );
      }

      // Set the artist_post_user_id in the input
      createReactionInput.artistPostUserId = artistPostUser.id;

      const reaction = await this.reactionRepository.save(
        this.reactionMapper.dtoToEntity(createReactionInput),
      );

      // Get the post owner's ID
      const postOwner = await this.artistPostUserService.getArtistPostByPostId(userId, postId);
      const postOwnerId = postOwner?.artistPost?.user_id;

      // Only create and send notification if the liker is not the post owner
      if (postOwnerId !== userId) {
        this.logger.debug('Creating notification for post like');
        try {
          // Check if the post owner is an artist
          const postOwnerUser = await this.artistPostUserService.getArtistPostByPostId(postOwnerId, postId);
          const isArtist = postOwnerUser?.user?.role?.includes(Roles.ARTIST);

          if (isArtist) {
            // For artists, check if we should bundle the notification
            const shouldBundle = await this.notificationBundlingService.shouldBundleNotification(
              postOwnerId,
              postId,
              NOTIFICATION_TYPE.LIKE_POST
            );

            if (shouldBundle) {
              // Create bundled notification
              const bundledNotification = await this.notificationBundlingService.createBundledNotification(
                postOwnerId,
                postId,
                NOTIFICATION_TYPE.LIKE_POST
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
              notification.data = JSON.stringify(reaction);
              notification.title = NOTIFICATION_TITLE.LIKE_POST;
              notification.is_read = false;
              notification.from_id = userId;
              
              // Get the liker's information
              const liker = await this.artistPostUserService.getArtistPostByPostId(userId, postId);
              
              notification.message = `${liker.user.full_name} liked your post`;
              notification.type = NOTIFICATION_TYPE.REACTION;
              notification.to_id = postOwnerId;
              notification.post_id = postId;
              
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
            // For non-artists, send individual notification as before
            const notification = new Notifications();
            notification.data = JSON.stringify(reaction);
            notification.title = NOTIFICATION_TITLE.LIKE_POST;
            notification.is_read = false;
            notification.from_id = userId;
            
            const liker = await this.artistPostUserService.getArtistPostByPostId(userId, postId);
            
            notification.message = `${liker.user.full_name} liked your post`;
            notification.type = NOTIFICATION_TYPE.REACTION;
            notification.to_id = postOwnerId;
            notification.post_id = postId;
            
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
        } catch (err) {
          this.logger.error('Error sending/saving reaction notification:', err);
          console.error('🚀 ~ Sending/Saving Reaction Notificaiton ~ err:', err);
        }
      } else {
        this.logger.debug('Skipping notification - user is liking their own post');
      }

      return reaction;
    } catch (error) {
      this.logger.error('Error in likeAPost:', error);
      console.error(
        '🚀 ~ file:reaction.service.ts:96 ~ ReactionService ~ createReaction ~ error:',
        error,
      );
      throw new HttpException(
        ` ${error?.message}`,
        error?.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Service to delete the Reaction
   * @param id
   * @returns {boolean}
   */
  async deleteReactionById(id: string, user: User): Promise<boolean> {
    try {
      const artistPostUser =
        await this.artistPostUserService.getArtistPostByPostId(user?.id, id);
      // Delete the signature based on both id and user_id
      const deleteResult = await this.reactionRepository.delete({
        artist_post_user_id: artistPostUser.id,
      });

      // Check if any rows were affected (i.e., deleted)
      if (deleteResult.affected === 0) {
        throw new HttpException(
          ERROR_MESSAGES.REACTION_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }

      return true;
    } catch (err) {
      console.error(
        '🚀 ~ file:reactions.service.ts:96 ~ ReactionsService ~ deleteReactionById ~ error:',
        err,
      );
      throw err;
    }
  }
}
