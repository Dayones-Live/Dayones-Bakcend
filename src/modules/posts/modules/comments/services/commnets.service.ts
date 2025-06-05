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
        if (artistPostUserGeneric.user_id !== userId) {
          createCommentInput.commentBy = userId;
        }
        const commentDto = this.commentsMapper.dtoToEntity(createCommentInput);
        // Use the upsert method
        comment = await this.commentsRepository.save(commentDto);
      } else {
        // Fetch the artistPostUserId through user id and artistPost
        artistPostUser = await this.artistPostUserService.getArtistPostByPostId(
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

      // Send notifications to post viewers and artist
      try {
        // Get all users who are viewing the post (except the commenter)
        const postViewers = await this.artistPostUserRepository.find({
          where: {
            artist_post_id: postId,
            status: Invite_Status.ACCEPTED,
            user_id: Not(userId), // Exclude the commenter
          },
          relations: ['user'],
        });

        // Get the artist (post creator) user_id
        let artistUserId: string | undefined;
        if (artistPostUserGeneric && artistPostUserGeneric.artistPost?.user_id) {
          artistUserId = artistPostUserGeneric.artistPost.user_id;
        } else if (artistPostUser && artistPostUser.artistPost?.user_id) {
          artistUserId = artistPostUser.artistPost.user_id;
        }

        // Build a set of user_ids to notify (viewers + artist, no duplicates, no commenter)
        const notifyUserIds = new Set<string>(postViewers.map(v => v.user_id));
        if (artistUserId && artistUserId !== userId) {
          notifyUserIds.add(artistUserId);
        }

        console.log('[CommentsService] Notifying user IDs:', Array.from(notifyUserIds));

        // Send notification to each recipient
        for (const notifyUserId of notifyUserIds) {
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
          
          // Get the user who commented
          const commenter = await this.artistPostUserRepository.findOne({
            where: { user_id: userId },
            relations: ['user']
          });
          
          notification.message = `${commenter.user.full_name} just commented`;
          notification.to_id = notifyUserId;

          const savedNotification = await this.notificationsRepository.save(notification);
          
          // Get active OneSignal player IDs for the recipient
          const playerIds = await this.userDeviceService.getActivePlayerIds(notifyUserId);
          console.log('[CommentsService] Player IDs for notifyUserId:', notifyUserId, playerIds);
          
          if (playerIds.length > 0) {
            console.log('[CommentsService] Sending push notification to notifyUserId:', notifyUserId);
            await this.pushNotificationService.sendPushNotification(
              playerIds,
              'DayOnes',
              `${commenter.user.full_name} Just Commented`,
              {
                type: NOTIFICATION_TYPE.COMMENT,
                post_id: postId,
                notification_id: savedNotification.id
              }
            );
            console.log('[CommentsService] Push notification sent to notifyUserId:', notifyUserId);
          } else {
            console.log('[CommentsService] No player IDs found for notifyUserId:', notifyUserId);
          }
        }
      } catch (err) {
        console.error('[CommentsService] Error sending/saving comment notifications:', err);
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
