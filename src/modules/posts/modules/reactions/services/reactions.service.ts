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
      this.logger.log(`[LIKE] Starting like process for post ${postId} by user ${userId}`);
      
      // Get the liker's information and verify access
      const liker = await this.artistPostUserService.getArtistPostByPostId(userId, postId);
      if (!liker) {
        this.logger.error(`[LIKE] Post ${postId} not found for user ${userId}`);
        throw new HttpException(
          ERROR_MESSAGES.POST_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }

      // Verify the user has proper access to the post
      const hasAccess = await this.artistPostUserService.verifyUserAccessToPost(userId, postId);
      if (!hasAccess) {
        this.logger.error(`[LIKE] User ${userId} does not have access to post ${postId}`);
        throw new HttpException(
          ERROR_MESSAGES.ACCESS_DENIED,
          HttpStatus.FORBIDDEN,
        );
      }

      this.logger.log(`[LIKE] Found liker: ${JSON.stringify({
        id: liker.id,
        userId: liker.user_id,
        role: liker.user?.role
      })}`);

      // Create and set up the reaction
      const reaction = new Reactions();
      reaction.artist_post_user_id = liker.id;
      reaction.react_by = userId;

      // Save the reaction first
      const savedReaction = await this.reactionRepository.save(reaction);
      this.logger.log(`[LIKE] Saved reaction with ID: ${savedReaction.id}`);

      // Get the liker's user information
      const likerUser = await this.artistPostUserService.getArtistPostByPostId(userId, postId);

      if (!likerUser) {
        this.logger.error(`[LIKE] User information not found for user ${userId}`);
        throw new HttpException(
          ERROR_MESSAGES.POST_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }

      // Check if the liker is an artist
      const isLikerArtist = likerUser?.user?.role?.includes(Roles.ARTIST);
      this.logger.log(`[LIKE] User ${userId} is artist: ${isLikerArtist}`);

      if (isLikerArtist) {
        // If liker is an artist, notify all fans with access
        const fansWithAccess = await this.artistPostUserService.getFansWithAccessToPost(postId, userId);
        this.logger.log(`[LIKE] Found ${fansWithAccess.length} fans to notify for post ${postId}`);
        
        for (const fan of fansWithAccess) {
          // Verify fan has proper access to the post
          const fanHasAccess = await this.artistPostUserService.verifyUserAccessToPost(fan.user_id, postId);
          if (!fanHasAccess) {
            this.logger.log(`[LIKE] Skipping notification for fan ${fan.user_id} - no access to post`);
            continue;
          }

          // Get active OneSignal player IDs for the fan
          const playerIds = await this.userDeviceService.getActivePlayerIds(fan.user_id);
          
          // Skip if the fan has the same device IDs as the liker
          const likerPlayerIds = await this.userDeviceService.getActivePlayerIds(userId);
          const hasCommonDevice = playerIds.some(id => likerPlayerIds.includes(id));
          if (hasCommonDevice) {
            this.logger.log(`[LIKE] Skipping notification for fan ${fan.user_id} - same device as liker`);
            continue;
          }
          
          this.logger.log(`[LIKE] Creating notification for fan ${fan.user_id}`);
          const notification = new Notifications();
          notification.to_id = fan.user_id;
          notification.is_read = false;
          notification.from_id = userId;
          notification.title = NOTIFICATION_TITLE.LIKE_POST;
          notification.data = JSON.stringify({
            post_id: postId,
          });
          notification.message = `${likerUser.user.full_name} liked a post`;
          notification.type = NOTIFICATION_TYPE.REACTION;
          notification.post_id = postId;

          const savedNotification = await this.notificationsRepository.save(notification);
          this.logger.log(`[LIKE] Saved notification with ID: ${savedNotification.id} for fan ${fan.user_id}`);

          if (playerIds.length > 0) {
            this.logger.log(`[LIKE] Sending push notification to fan ${fan.user_id} with player IDs: ${playerIds.join(', ')}`);
            await this.pushNotificationService.sendPushNotification(
              playerIds,
              notification.title,
              notification.message,
              {
                type: notification.type,
                post_id: notification.post_id,
                notification_id: savedNotification.id,
                user_id: fan.user_id // Add user_id to help frontend identify the correct account
              }
            );
            this.logger.log(`[LIKE] Successfully sent push notification to fan ${fan.user_id}`);
          } else {
            this.logger.warn(`[LIKE] No active devices found for fan ${fan.user_id}`);
          }
        }
      } else {
        // If liker is a fan, only notify the post owner (artist)
        const postOwnerId = await this.artistPostUserService.getPostOwnerId(postId);
        this.logger.log(`[LIKE] Post owner ID: ${postOwnerId}`);

        // Skip if the post owner is the same as the liker
        if (postOwnerId === userId) {
          this.logger.log(`[LIKE] Skipping notification for liker ${userId} (post owner)`);
        } else {
          // Verify artist has proper access to the post
          const artistHasAccess = await this.artistPostUserService.verifyUserAccessToPost(postOwnerId, postId);
          if (!artistHasAccess) {
            this.logger.log(`[LIKE] Skipping notification for artist ${postOwnerId} - no access to post`);
            return savedReaction;
          }

          // Get active OneSignal player IDs for the artist
          const playerIds = await this.userDeviceService.getActivePlayerIds(postOwnerId);
          
          if (playerIds.length > 0) {
            this.logger.log(`[LIKE] Creating notification for artist ${postOwnerId}`);
            const notification = new Notifications();
            notification.to_id = postOwnerId;
            notification.is_read = false;
            notification.from_id = userId;
            notification.title = NOTIFICATION_TITLE.LIKE_POST;
            notification.data = JSON.stringify({
              post_id: postId,
            });
            notification.message = `${likerUser.user.full_name} liked your post`;
            notification.type = NOTIFICATION_TYPE.REACTION;
            notification.post_id = postId;

            const savedNotification = await this.notificationsRepository.save(notification);
            this.logger.log(`[LIKE] Saved notification with ID: ${savedNotification.id} for artist ${postOwnerId}`);

            this.logger.log(`[LIKE] Sending push notification to artist ${postOwnerId} with player IDs: ${playerIds.join(', ')}`);
            await this.pushNotificationService.sendPushNotification(
              playerIds,
              notification.title,
              notification.message,
              {
                type: notification.type,
                post_id: notification.post_id,
                notification_id: savedNotification.id,
                user_id: postOwnerId // Add user_id to help frontend identify the correct account
              }
            );
            this.logger.log(`[LIKE] Successfully sent push notification to artist ${postOwnerId}`);
          } else {
            this.logger.warn(`[LIKE] No active devices found for artist ${postOwnerId}`);
          }
        }
      }

      return savedReaction;
    } catch (error) {
      this.logger.error(`[LIKE] Error in likeAPost: ${error.message}`, error.stack);
      throw new HttpException(` ${error?.message}`, HttpStatus.BAD_REQUEST);
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