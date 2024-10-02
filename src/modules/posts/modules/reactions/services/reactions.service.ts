import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Reactions } from '../entities/reaction.entity';
import { ReactionsMapper } from '../dto/reaction.mapper';
import { CreateReactionInput } from '../dto/types';
import { ArtistPostUserService } from '../../artist-post-user/services/artist-post-user.service';

@Injectable()
export class ReactionService {
  constructor(
    @InjectRepository(Reactions)
    private reactionsRepository: Repository<Reactions>,
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
      // Fetch the artistPostUserId through user id and artistPost
      const artistPostUser =
        await this.artistPostUserService.getArtistPostByPostId(userId, postId);
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
  async deleteReactionById(id: string): Promise<boolean> {
    try {
      // Delete the signature based on both id and user_id
      const deleteResult = await this.reactionsRepository.delete({
        id: id,
      });

      // Check if any rows were affected (i.e., deleted)
      if (deleteResult.affected === 0) {
        throw new HttpException(
          `Reaction not found or already deleted`,
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
