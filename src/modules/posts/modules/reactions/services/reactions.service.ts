import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Reactions } from '../entities/reaction.entity';
import { ReactionsMapper } from '../dto/reaction.mapper';
import { CreateReactionInput } from '../dto/types';

@Injectable()
export class ReactionService {
  constructor(
    @InjectRepository(Reactions)
    private reactionsRepository: Repository<Reactions>,
    private reactionsMapper: ReactionsMapper,
  ) {}

  /**
   * Service to create a new Comment
   * @param Creation
   * @returns {Reactions}
   */
  async createReaction(
    createReactionInput: CreateReactionInput,
  ): Promise<Reactions> {
    try {
      const dto = this.reactionsMapper.dtoToEntity(createReactionInput);
      // Use the upsert method
      const reaction = await this.reactionsRepository.save(dto);
      return reaction;
    } catch (error) {
      console.error(
        '🚀 ~ file:reaction.service.ts:96 ~ ReactionService ~ createReaction ~ error:',
        error,
      );
      throw new HttpException(` ${error?.message}`, HttpStatus.BAD_REQUEST);
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
