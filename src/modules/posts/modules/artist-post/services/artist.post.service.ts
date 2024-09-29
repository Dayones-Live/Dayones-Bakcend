import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ArtistPost } from '../entities/artist.post.entity';
import {
  ArtistPostObject,
  CreateArtistPostInput,
  UpdateArtistPostInput,
} from '../dto/types';

@Injectable()
export class ArtistPostService {
  constructor(
    @InjectRepository(ArtistPost)
    private artistPostRepository: Repository<ArtistPost>,
  ) {}

  /**
   *
   * @param createArtistPostInput
   * @returns {ArtistPost}
   */
  async createArtistPost(
    createArtistPostInput: CreateArtistPostInput,
  ): Promise<ArtistPostObject> {
    try {
      // Use the upsert method
      const artistPost = await this.artistPostRepository.save(
        createArtistPostInput,
      );
      const { user_id, ...rest } = artistPost;
      return rest;
    } catch (error) {
      console.error(
        '🚀 ~ file:artist.post.service.ts:96 ~ ArtistPostService ~ createArtistPost ~ error:',
        error,
      );
      throw new HttpException(` ${error?.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   *
   * @param updateArtistPostInput
   * @returns {ArtistPostObject}
   */
  async updateArtistPost(
    updateArtistPostInput: UpdateArtistPostInput,
  ): Promise<ArtistPostObject> {
    try {
      // Fetch the existing post based on id and user_id
      const existingPost = await this.artistPostRepository.findOne({
        where: {
          id: updateArtistPostInput.id,
          user_id: updateArtistPostInput.user_id,
        },
      });
      // If no post is found, throw an error
      if (!existingPost) {
        throw new HttpException(`Artist post not found`, HttpStatus.NOT_FOUND);
      }
      // Update the post using save (this will update only the changed fields)
      const updatedPost = await this.artistPostRepository.save({
        ...existingPost, // Keep existing properties
        ...updateArtistPostInput, // Overwrite with new values from input
      });
      // Exclude user_id and cast the result to exclude TypeORM methods
      const { user_id, ...rest } = updatedPost;
      return rest;
    } catch (error) {
      console.error(
        '🚀 ~ file:artist.post.service.ts:96 ~ ArtistPostService ~ updateArtistPost ~ error:',
        error,
      );
      throw new HttpException(` ${error?.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  async deleteArtistPostById(id: string, user_id: string): Promise<boolean> {
    try {
      // Delete the signature based on both id and user_id
      const deleteResult = await this.artistPostRepository.delete({
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
        '🚀 ~ file:artist.post.service.ts:96 ~ ArtistPostService ~ deleteArtistPostById ~ error:',
        err,
      );
      throw err;
    }
  }

  /**
   *
   * @param user_id
   * @returns
   */
  async fetchAllArtistPost(user_id: string): Promise<ArtistPostObject[]> {
    try {
      const artistPosts: ArtistPostObject[] =
        await this.artistPostRepository.find({
          where: {
            user_id,
          },
        });
      return artistPosts;
    } catch (error) {
      console.error(
        '🚀 ~ file:artist.post.service.ts:96 ~ ArtistPostService ~ fetchAllArtistPost ~ error:',
        error,
      );
      throw error;
    }
  }
}
