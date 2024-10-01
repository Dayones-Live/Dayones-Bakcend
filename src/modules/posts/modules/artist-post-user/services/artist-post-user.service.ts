import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  CreateArtistPostUserInput,
  UpdateArtistPostUserInput,
} from '../dto/types';
import { ArtistPostUser } from '../entities/artist-post-user.entity';
import { ArtistPostUserMapper } from '../dto/atrist-post-user.mapper';

@Injectable()
export class ArtistPostUserService {
  constructor(
    @InjectRepository(ArtistPostUser)
    private artistPostUserRepository: Repository<ArtistPostUser>,
    private artistPostUserMapper: ArtistPostUserMapper,
  ) {}

  /**
   * Service to create artist post user
   * @param createArtistPostUserInput
   * @returns {ArtistPostUser}
   */
  async createArtistPostUser(
    createArtistPostUserInput: CreateArtistPostUserInput,
  ): Promise<ArtistPostUser> {
    try {
      const dto = this.artistPostUserMapper.dtoToEntity(
        createArtistPostUserInput,
      );
      // Use the upsert method
      const artistPostUser = await this.artistPostUserRepository.save(dto);
      return artistPostUser;
    } catch (error) {
      console.error(
        '🚀 ~ file:artist.post.user.service.ts:96 ~ ArtistPostUserService ~ createArtistPostUser ~ error:',
        error,
      );
      throw new HttpException(` ${error?.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Service to update the artist post user
   * @param updateArtistPostUserInput
   * @returns {ArtistPost}
   */
  async updateArtistPostUser(
    updateArtistPostUserInput: UpdateArtistPostUserInput,
  ): Promise<ArtistPostUser> {
    try {
      // Fetch the existing post based on id and user_id
      const existingPostUser = await this.artistPostUserRepository.findOne({
        where: {
          id: updateArtistPostUserInput.id,
          user_id: updateArtistPostUserInput.userId,
        },
      });
      // If no post is found, throw an error
      if (!existingPostUser) {
        throw new HttpException(
          `Artist post User not found`,
          HttpStatus.NOT_FOUND,
        );
      }
      const updateDto = this.artistPostUserMapper.dtoToEntityUpdate(
        existingPostUser,
        updateArtistPostUserInput,
      );
      // Update the post using save (this will update only the changed fields)
      const artistPostUser =
        await this.artistPostUserRepository.save(updateDto);
      // Exclude user_id and cast the result to exclude TypeORM methods
      return artistPostUser;
    } catch (error) {
      console.error(
        '🚀 ~ file:artist.post.user.service.ts:96 ~ ArtistPostUserService ~ updateArtistPostUser ~ error:',
        error,
      );
      throw new HttpException(` ${error?.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Service to delete the artist post user
   * @param id
   * @param user_id
   * @returns {boolean}
   */
  async deleteArtistPostUserById(
    id: string,
    user_id: string,
  ): Promise<boolean> {
    try {
      // Delete the signature based on both id and user_id
      const deleteResult = await this.artistPostUserRepository.delete({
        id: id,
        user_id: user_id,
      });

      // Check if any rows were affected (i.e., deleted)
      if (deleteResult.affected === 0) {
        throw new HttpException(
          `Artist Post not found or already deleted`,
          HttpStatus.NOT_FOUND,
        );
      }

      return true;
    } catch (err) {
      console.error(
        '🚀 ~ file:artist.post.user.service.ts:96 ~ deleteArtistPostUserById ~ deleteArtistPostById ~ error:',
        err,
      );
      throw err;
    }
  }
}
