import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
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

@Injectable()
export class ReactionService {
  constructor(
    @InjectRepository(Reactions)
    private reactionsRepository: Repository<Reactions>,
    @InjectRepository(Notifications)
    private notificationsRepository: Repository<Notifications>,
    private reactionsMapper: ReactionsMapper,
    private artistPostUserService: ArtistPostUserService,
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
      let artistPostUser: ArtistPostUser = {} as ArtistPostUser;
      let reaction: Reactions = {} as Reactions;
      let toId: string = '';

      // Retrieve the generic artist post user based on the post ID
      const artistPostUserGeneric =
        await this.artistPostUserService.getGenericArtistPostUserByPostId(
          postId,
        );

      if (artistPostUserGeneric) {
        const isAlreadyLikes = await this.reactionsRepository.findOne({
          where: {
            artist_post_user_id: artistPostUserGeneric?.id,
            react_by: userId,
          },
        });

        if (isAlreadyLikes) {
          throw new HttpException(`Post Already Liked!`, HttpStatus.CONFLICT);
        }
        createReactionInput.artistPostUserId = artistPostUserGeneric?.id;
        if (artistPostUserGeneric.user_id !== userId) {
          createReactionInput.reactBy = userId;
        }
        const reactionDto =
          this.reactionsMapper.dtoToEntity(createReactionInput);
        // Use the upsert method
        reaction = await this.reactionsRepository.save(reactionDto);
        toId = artistPostUserGeneric.user_id;
      } else {
        // Fetch the artistPostUserId through user id and artistPost
        const artistPostUser =
          await this.artistPostUserService.getArtistPostByPostId(
            userId,
            postId,
          );
        if (
          artistPostUser?.status !== Invite_Status.ACCEPTED &&
          artistPostUser?.user?.role[0] !== Roles.ARTIST
        ) {
          throw new HttpException(
            ERROR_MESSAGES.INVITE_NOT_ACCEPTED,
            HttpStatus.FORBIDDEN,
          );
        }
        const isAlreadyLikes = await this.reactionsRepository.findOne({
          where: {
            artist_post_user_id: artistPostUser?.id,
          },
        });
        if (isAlreadyLikes) {
          throw new HttpException(`Post Already Liked!`, HttpStatus.CONFLICT);
        }
        createReactionInput.artistPostUserId = artistPostUser?.id;
        const reactionDto =
          this.reactionsMapper.dtoToEntity(createReactionInput);
        // Use the upsert method
        reaction = await this.reactionsRepository.save(reactionDto);
        toId = artistPostUser?.user_id;
      }

      // Create and save notification
      try {
        const notification = new Notifications();
        notification.data = JSON.stringify(reaction);
        notification.title = NOTIFICATION_TITLE.LIKE_POST;
        notification.is_read = false;
        notification.from_id = userId;
        notification.message = 'Someone like your post';
        notification.type = NOTIFICATION_TYPE.REACTION;
        notification.to_id = toId;
        notification.post_id = postId;
        
        await this.notificationsRepository.save(notification);
      } catch (err) {
        console.error('🚀 ~ Sending/Saving Reaction Notificaiton ~ err:', err);
      }

      return reaction;
    } catch (error) {
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
