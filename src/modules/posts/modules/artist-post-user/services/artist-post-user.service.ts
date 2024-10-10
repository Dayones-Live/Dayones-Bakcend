import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  CreateArtistPostUserInput,
  UpdateArtistPostUserInput,
} from '../dto/types';
import { ArtistPostUser } from '../entities/artist-post-user.entity';
import { ArtistPostUserMapper } from '../dto/atrist-post-user.mapper';
import { InviteStatus } from 'aws-sdk/clients/chime';
import { Invite_Status } from '../constants/constants';
import { User } from '@user/entities/user.entity';
import { ERROR_MESSAGES, Roles } from '@app/shared/constants/constants';
import { ArtistPost } from '../../artist-post/entities/artist-post.entity';
import {
  AllPostsResponse,
  ArtistPostResponse,
} from '../../artist-post/dto/types';
import { Paginate, PaginationDto } from '@app/types';
import { getPaginated, getPaginatedOutput } from '@app/shared/utils';

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
      const artistPostUserDto = this.artistPostUserMapper.dtoToEntity(
        createArtistPostUserInput,
      );
      // Use the upsert method
      const artistPostUser =
        await this.artistPostUserRepository.save(artistPostUserDto);
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
      const existingInvite = await this.artistPostUserRepository
        .createQueryBuilder('artistPostUser')
        .leftJoin('artistPostUser.artistPost', 'artistPost') // Join with user entity
        .andWhere('artistPostUser.id = :id', {
          id: updateArtistPostUserInput?.id,
        })
        .andWhere('artistPostUser.user_id = :user_id', {
          user_id: updateArtistPostUserInput?.userId,
        }) // Filter by user_id
        .getOne();
      // If no post is found, throw an error
      if (!existingInvite) {
        throw new HttpException(
          ERROR_MESSAGES.INVITE_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      if (existingInvite.status === Invite_Status.ACCEPTED) {
        throw new HttpException(`Invite Already Accepted`, HttpStatus.CONFLICT);
      }
      const updateDto = this.artistPostUserMapper.dtoToEntityUpdate(
        existingInvite,
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
        throw new HttpException(`Invite not found`, HttpStatus.NOT_FOUND);
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

  /**
   * Fetch all ArtistPostUser records where valid_till is greater than current date
   */
  async fetchValidArtistInvites(user: User): Promise<ArtistPostUser[]> {
    try {
      const currentDate = new Date();
      if (user.role[0] === Roles.ARTIST) {
        const artistValidInvites = await this.artistPostUserRepository
          .createQueryBuilder('artistPostUser')
          .leftJoin('artistPostUser.artistPost', 'artistPost') // Join with user entity
          .where('artistPostUser.valid_till > :currentDate', { currentDate })
          .where('artistPostUser.status = :status', {
            status: Invite_Status.ACCEPTED,
          })
          .andWhere('artistPost.user_id = :user_id', { user_id: user?.id }) // Filter by user_id
          .getMany();

        return artistValidInvites;
      } else {
        const artistValidInvites = await this.artistPostUserRepository
          .createQueryBuilder('artistPostUser')
          .leftJoin('artistPostUser.artistPost', 'artistPost') // Join with user entity
          .where('artistPostUser.valid_till > :currentDate', { currentDate })
          .andWhere('artistPostUser.user_id = :user_id', { user_id: user?.id }) // Filter by user_id
          .getMany();

        return artistValidInvites;
      }
    } catch (err) {
      console.error(
        '🚀 ~ file:artist.post.user.service.ts:96 ~ deleteArtistPostUserById ~ fetchValidArtistPostUsers ~ error:',
        err,
      );
      throw err;
    }
  }

  /**
   * Fetch all ArtistPostUser records where valid_till is greater than current date
   */
  async fetchUserPostsByInviteStatus(
    user_id: string,
    status: InviteStatus,
    req: PaginationDto,
  ): Promise<AllPostsResponse> {
    try {
      const paginate: Paginate = getPaginated(
        req.pageNo || 1,
        req.pageSize || 0,
      );
      const [artistValidInvites, count] = await this.artistPostUserRepository
        .createQueryBuilder('artistPostUser')
        .leftJoinAndSelect('artistPostUser.artistPost', 'artistPost') // Join with user entity
        .where('artistPostUser.status = :status', { status })
        .andWhere('artistPostUser.user_id = :user_id', { user_id }) // Filter by user_id
        .skip(paginate.offset) // Apply offset for pagination
        .take(paginate.limit) // Apply limit for pagination
        .getManyAndCount();
      if (!artistValidInvites.length) {
        throw new HttpException(
          ERROR_MESSAGES.POST_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      const artistPosts = artistValidInvites.map((invite) => invite.artistPost);
      const meta = getPaginatedOutput(
        paginate.pageNo,
        paginate.pageSize,
        count,
      );
      return { posts: artistPosts, meta };
    } catch (err) {
      console.error(
        '🚀 ~ file:artist.post.user.service.ts:96 ~ deleteArtistPostUserById ~ fetchValidArtistPostUsers ~ error:',
        err,
      );
      throw err;
    }
  }

  /**
   * Fetch all User comments
   */
  async fetchUserCommentsAndReaction(
    userId: string,
    postId: string,
  ): Promise<ArtistPostResponse> {
    try {
      const artistValidInvites = await this.artistPostUserRepository
        .createQueryBuilder('artistPostUser')
        .leftJoinAndSelect('artistPostUser.artistPost', 'artistPost') // Join with user entity
        .leftJoinAndSelect('artistPostUser.comment', 'comment')
        .leftJoinAndSelect('artistPostUser.reaction', 'reaction')
        .where('artistPostUser.status = :status', {
          status: Invite_Status.ACCEPTED,
        })
        .andWhere('artistPostUser.user_id = :user_id', { user_id: userId })
        .andWhere('artistPost.id = :postId', { postId: postId }) // Filter by user_id
        .getOne();
      if (!artistValidInvites) {
        throw new HttpException(
          ERROR_MESSAGES.POST_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      return {
        post: artistValidInvites?.artistPost || null,
        comments: artistValidInvites?.comment,
        reaction: artistValidInvites?.reaction ? 1 : 0,
      };
    } catch (err) {
      console.error(
        '🚀 ~ file:artist.post.user.service.ts:96  ~ fetchComments ~ error:',
        err,
      );
      throw err;
    }
  }

  /**
   * Fetch all User comments
   */
  async getArtistPostByPostId(
    userId: string,
    postId: string,
  ): Promise<ArtistPostUser> {
    try {
      const artistPostUser = await this.artistPostUserRepository.findOne({
        where: {
          artist_post_id: postId,
          user_id: userId,
        },
      });
      if (!artistPostUser) {
        throw new HttpException(
          ERROR_MESSAGES.POST_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      return artistPostUser;
    } catch (err) {
      console.error(
        '🚀 ~ file:artist.post.user.service.ts:96  ~ fetchComments ~ error:',
        err,
      );
      throw err;
    }
  }

  /**
   * Service to delete the artist post invites that are no longer valid or
   * rejected by the user
   *
   * @returns {boolean}
   * */

  async deleteRejectedOrStaleInvites(): Promise<boolean> {
    const now = new Date();

    try {
      const artistPostUsersDelete = await this.artistPostUserRepository
        .createQueryBuilder('artistPostUser')
        .where(
          'artistPostUser.status = :rejected OR artistPostUser.valid_till < :now',
          {
            rejected: Invite_Status.REJECT,
            now,
          },
        )
        .getMany();

      if (artistPostUsersDelete?.length > 0) {
        // Delete the invites
        const deletedInvites = await this.artistPostUserRepository.remove(
          artistPostUsersDelete,
        );

        console.log(`${artistPostUsersDelete.length} invites deleted.`);
        return deletedInvites?.length > 0;
      }
      return true;
    } catch (error) {
      console.error(
        '🚀 ~ ArtistPostUserService ~ deleteRejectedOrStaleInvites ~ error:',
        error,
      );
      throw error;
    }
  }
}
