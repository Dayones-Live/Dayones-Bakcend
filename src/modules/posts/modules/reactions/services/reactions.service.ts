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
import { FirebaseService } from '@app/modules/user/modules/ notifications/services/notification.service';
import { AddNotificationInput } from '@app/modules/user/modules/ notifications/dto/types';
import { NOTIFICATION_TYPE } from '@app/modules/user/modules/ notifications/constants';

@Injectable()
export class ReactionService {
  constructor(
    @InjectRepository(Reactions)
    private reactionsRepository: Repository<Reactions>,
    private reactionsMapper: ReactionsMapper,
    private artistPostUserService: ArtistPostUserService,
    private readonly firebaseService: FirebaseService,
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
      // Fetch the artistPostUserId through user id and artistPost
      const artistPostUser =
        await this.artistPostUserService.getArtistPostByPostId(userId, postId);
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
      const reactionDto = this.reactionsMapper.dtoToEntity(createReactionInput);
      // Use the upsert method
      const reaction = await this.reactionsRepository.save(reactionDto);

      // Sending and saving notifications of reactions
      try {
        const notification: AddNotificationInput = {
          data: 'Like',
          title: 'Like',
          isRead: false,
          fromId: userId,
          message: 'Someone like your post',
          type: NOTIFICATION_TYPE.REACTION,
          toId: artistPostUser?.artistPost?.user_id,
        };
        await this.firebaseService.addNotification(notification);
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
