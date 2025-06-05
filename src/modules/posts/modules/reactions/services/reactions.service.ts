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

@Injectable()
export class ReactionService {
  private readonly logger = new Logger(ReactionService.name);

  constructor(
    @InjectRepository(Reactions)
    private reactionsRepository: Repository<Reactions>,
    @InjectRepository(Notifications)
    private notificationsRepository: Repository<Notifications>,
    @InjectRepository(ArtistPost)
    private artistPostRepository: Repository<ArtistPost>,
    private reactionsMapper: ReactionsMapper,
    private artistPostUserService: ArtistPostUserService,
    private pushNotificationService: PushNotificationService,
    private userDeviceService: UserDeviceService,
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
      let reaction: Reactions = {} as Reactions;
      let postOwnerId: string = '';

      this.logger.debug(`Processing like for post ${postId} by user ${userId}`);

      // First, get the post to find the owner
      const post = await this.artistPostRepository.findOne({
        where: { id: postId },
        relations: ['user'],
      });

      if (!post) {
        throw new HttpException(
          ERROR_MESSAGES.POST_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }

      postOwnerId = post.user_id;
      this.logger.debug(`Post owner ID: ${postOwnerId}, User ID: ${userId}`);

      // Get the artist post user record for this post
      const artistPostUser = await this.artistPostUserService.getArtistPostByPostId(
        userId,
        postId,
      );

      if (!artistPostUser) {
        throw new HttpException(
          ERROR_MESSAGES.POST_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }

      // Check if user has already liked the post
      const isAlreadyLiked = await this.reactionsRepository.findOne({
        where: {
          artist_post_user_id: artistPostUser.id,
          react_by: userId,
        },
      });

      if (isAlreadyLiked) {
        throw new HttpException(`Post Already Liked!`, HttpStatus.CONFLICT);
      }

      // Create the reaction
      createReactionInput.artistPostUserId = artistPostUser.id;
      createReactionInput.reactBy = userId;
      const reactionDto = this.reactionsMapper.dtoToEntity(createReactionInput);
      reaction = await this.reactionsRepository.save(reactionDto);

      // Only create and send notification if the liker is not the post owner
      if (postOwnerId !== userId) {
        this.logger.debug('Creating notification for post like');
        try {
          const notification = new Notifications();
          notification.data = JSON.stringify(reaction);
          notification.title = NOTIFICATION_TITLE.LIKE_POST;
          notification.is_read = false;
          notification.from_id = userId;
          notification.message = `${post.user.full_name} liked your post`;
          notification.type = NOTIFICATION_TYPE.REACTION;
          notification.to_id = postOwnerId; // Send to post owner
          notification.post_id = postId;
          
          const savedNotification = await this.notificationsRepository.save(notification);
          this.logger.debug('Notification saved:', savedNotification);

          // Get active OneSignal player IDs for the post owner
          const playerIds = await this.userDeviceService.getActivePlayerIds(postOwnerId);
          this.logger.debug(`Found ${playerIds.length} player IDs for post owner ${postOwnerId}:`, playerIds);
          
          if (playerIds.length > 0) {
            this.logger.debug('Sending push notification');
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
            this.logger.debug('Push notification sent successfully');
          } else {
            this.logger.warn(`No active player IDs found for post owner ${postOwnerId}`);
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
      const deleteResult = await this.reactionsRepository.delete({
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
