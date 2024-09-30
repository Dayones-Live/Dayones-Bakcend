import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ArtistPostUser } from '../entities/artist.post.user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  CreateArtistPostUserInput,
  UpdateArtistPostUserInput,
} from '../dto/types';

@Injectable()
export class ArtistPostUserService {
  constructor(
    @InjectRepository(ArtistPostUser)
    private artistPostUserRepository: Repository<ArtistPostUser>,
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
      // Use the upsert method
      const artistPostUser = await this.artistPostUserRepository.save(
        createArtistPostUserInput,
      );
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
      const existingPost = await this.artistPostUserRepository.findOne({
        where: {
          id: updateArtistPostUserInput.id,
          user_id: updateArtistPostUserInput.user_id,
        },
      });
      // If no post is found, throw an error
      if (!existingPost) {
        throw new HttpException(
          `Artist post User not found`,
          HttpStatus.NOT_FOUND,
        );
      }
      // Update the post using save (this will update only the changed fields)
      const artistPostUser = await this.artistPostUserRepository.save({
        ...existingPost, // Keep existing properties
        ...updateArtistPostUserInput, // Overwrite with new values from input
      });
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
