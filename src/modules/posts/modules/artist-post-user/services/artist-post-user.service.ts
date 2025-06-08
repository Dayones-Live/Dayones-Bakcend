import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  CreateArtistPostUserInput,
  UpdateArtistPostUserInput,
  UserInvitesResponse,
} from '../dto/types';
import { ArtistPostUser } from '../entities/artist-post-user.entity';
import { ArtistPostUserMapper } from '../dto/atrist-post-user.mapper';
import { InviteStatus } from 'aws-sdk/clients/chime';
import { Invite_Status } from '../constants/constants';
import { User } from '@app/modules/user/entities/user.entity';
import { ERROR_MESSAGES, Roles } from '@app/shared/constants/constants';
import { ArtistPost } from '@app/modules/posts/modules/artist-post/entities/artist-post.entity';
import {
  AllPostsResponse,
  ArtistPostResponse,
} from '../../artist-post/dto/types';
import { Paginate, PaginationDto } from '@app/types';
import { getPaginated, getPaginatedOutput } from '@app/shared/utils';
import { Cron, CronExpression } from '@nestjs/schedule';
import { In } from 'typeorm';

@Injectable()
export class ArtistPostUserService {
  constructor(
    @InjectRepository(ArtistPostUser)
    private artistPostUserRepository: Repository<ArtistPostUser>,
    @InjectRepository(ArtistPost)
    private artistPostRepository: Repository<ArtistPost>,
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
  async fetchValidArtistInvites(
    user: User,
  ): Promise<ArtistPostUser[] | UserInvitesResponse[]> {
    try {
      const currentDate = new Date();
      if (user.role[0] === Roles.ARTIST) {
        const artistValidInvites = await this.artistPostUserRepository
          .createQueryBuilder('artistPostUser')
          .leftJoin('artistPostUser.artistPost', 'artistPost') // Join with user entity
          .leftJoin('artistPostUser.user', 'user') // Join with user entity
          .addSelect([
            'user.id',
            'user.full_name',
            'user.email',
            'user.phone_number',
            'user.avatar_url',
          ]) // Select specific fields from user
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
          .leftJoinAndSelect('artistPostUser.artistPost', 'artistPost') // Join with artistPost entity
          .leftJoin('artistPost.user', 'user') // Join with the user entity from artistPost
          .addSelect([
            'user.id',
            'user.full_name',
            'user.email',
            'user.phone_number',
            'user.avatar_url',
          ]) // Select specific fields from the user
          .where('artistPostUser.valid_till > :currentDate', { currentDate })
          .andWhere('artistPostUser.user_id = :user_id', { user_id: user?.id }) // Filter by user_id
          .getMany();
        return this.artistPostUserMapper.processInvitesToAddUser(
          artistValidInvites,
        );
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
  async fetchAcceptedPostsIds(user_id: string): Promise<any> {
    try {
      const acceptedInviteArtistPostIds = await this.artistPostUserRepository
        .createQueryBuilder('artistPostUser')
        .where('artistPostUser.status IN (:...statuses)', {
          statuses: [Invite_Status.ACCEPTED, Invite_Status.GENERIC], // Filter for ACCEPTED status as well as Generic, which is for all the fans
        })
        .andWhere('artistPostUser.user_id = :user_id', { user_id }) // Filter by user_id
        .getMany();

      const artistPostIds = acceptedInviteArtistPostIds.map(
        (invite) => invite.artist_post_id,
      );
      return artistPostIds;
    } catch (err) {
      console.error(
        '🚀 ~ file:artist.post.user.service.ts:96 ~ deleteArtistPostUserById ~ fetchValidArtistPostUsers ~ error:',
        err,
      );
      throw err;
    }
  }

  /**
   * Fetches the user IDs of all fans who have accepted invites to follow an artist's posts.
   *
   * @param userId - The ID of the user whose fans' posts we want to retrieve.
   * @returns An array of user IDs of the fans who have accepted invites to follow the artist's posts.
   */
  async fetchFanOfArtistsGenericPostsIds(userId: string): Promise<string[]> {
    try {
      const fanOfArtists = await this.artistPostUserRepository
        .createQueryBuilder('artistPostUser')
        .leftJoinAndSelect('artistPostUser.artistPost', 'artistPost')
        .leftJoinAndSelect('artistPost.user', 'user')
        .where('artistPostUser.user_id = :userId', { userId })
        .andWhere('artistPostUser.status = :status', {
          status: Invite_Status.ACCEPTED,
        })
        .getMany();

      // Return an array of user ids
      return [
        ...new Set(fanOfArtists.map((artist) => artist.artistPost.user.id)),
      ];
    } catch (err) {
      console.error(
        '🚀 ~ file: artist.post.user.service.ts: fetchFanOfArtistsGenericPostsIds ~ error:',
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
        .leftJoin('comment.user', 'commentedUser')
        .addSelect([
          'commentedUser.id',
          'commentedUser.full_name',
          'commentedUser.email',
          'commentedUser.phone_number',
          'commentedUser.avatar_url',
        ]) // Select specific fields from user
        .leftJoinAndSelect('comment.commentReaction', 'commentReaction')
        .leftJoinAndSelect('artistPostUser.reaction', 'reaction')
        .leftJoin('reaction.user', 'reactedUser')
        .addSelect([
          'reactedUser.id',
          'reactedUser.full_name',
          'reactedUser.email',
          'reactedUser.phone_number',
          'reactedUser.avatar_url',
        ]) // Select specific fields from user
        .leftJoin('artistPostUser.user', 'user')
        .addSelect([
          'user.id',
          'user.full_name',
          'user.email',
          'user.phone_number',
          'user.avatar_url',
          'user.role',
        ]) // Select specific fields from user
        .leftJoin('artistPost.user', 'artist')
        .addSelect([
          'artist.id',
          'artist.full_name',
          'artist.phone_number',
          'artist.avatar_url',
        ]) // Select specific fields from user (artist)
        .andWhere('artistPostUser.status IN (:...statuses)', {
          statuses: [
            Invite_Status.ACCEPTED,
            Invite_Status.NULL,
            Invite_Status.GENERIC,
          ], // Filter for both ACCEPTED and NULL statuses
        })
        .andWhere('artistPost.id = :postId', { postId: postId })
        .andWhere(
          '(artistPostUser.user_id = :currentUserId OR artistPost.user_id = artistPostUser.user_id)',
          { currentUserId: userId },
        )
        .getMany();
      if (!artistValidInvites?.length) {
        throw new HttpException(
          ERROR_MESSAGES.POST_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      const formattedInvites =
        this.artistPostUserMapper.processArtistValidInvites(artistValidInvites);
      return formattedInvites;
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
      const artistGenericPost =
        await this.getGenericArtistPostUserByPostId(postId);
      if (artistGenericPost) {
        return artistGenericPost;
      }

      const artistPostUser = await this.artistPostUserRepository.findOne({
        relations: ['user', 'artistPost', 'artistPost.user'],
        where: {
          artist_post_id: postId,
          user_id: userId,
        },
      });
      return artistPostUser as ArtistPostUser;
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
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async deleteRejectedOrStaleInvites(): Promise<boolean> {
    const now = new Date();
    try {
      const artistPostUsersDelete = await this.artistPostUserRepository
        .createQueryBuilder('artistPostUser')
        .where(
          '(artistPostUser.status = :rejected OR artistPostUser.valid_till < :now) AND artistPostUser.status NOT IN (:...excludedStatuses)',
          {
            rejected: Invite_Status.REJECT,
            now,
            excludedStatuses: [Invite_Status.ACCEPTED, Invite_Status.NULL],
          },
        )
        .getMany();

      if (artistPostUsersDelete?.length > 0) {
        // Delete the invites
        const deletedInvites = await this.artistPostUserRepository.remove(
          artistPostUsersDelete,
        );
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

  /**
   * Fetch all User comments
   */
  async getGenericArtistPostUserByPostId(
    postId: string,
  ): Promise<ArtistPostUser> {
    try {
      const artistPostUser = await this.artistPostUserRepository.findOne({
        relations: ['user', 'artistPost', 'artistPost.user'],
        where: {
          artist_post_id: postId,
          status: Invite_Status.GENERIC,
        },
      });
      return artistPostUser as ArtistPostUser;
    } catch (err) {
      console.error(
        '🚀 ~ file:artist.post.user.service.ts:96  ~ fetchComments ~ error:',
        err,
      );
      throw err;
    }
  }

  /**
   * Get all fans who have access to a post
   * @param postId - The ID of the post
   * @returns Array of ArtistPostUser records for fans with access
   */
  async getFansWithAccessToPost(postId: string): Promise<ArtistPostUser[]> {
    try {
      const fans = await this.artistPostUserRepository.find({
        relations: ['user'],
        where: {
          artist_post_id: postId,
          status: In([Invite_Status.ACCEPTED, Invite_Status.GENERIC]),
        },
      });
      return fans;
    } catch (err) {
      console.error(
        '🚀 ~ file:artist.post.user.service.ts ~ getFansWithAccessToPost ~ error:',
        err,
      );
      throw err;
    }
  }

  async getPostOwnerId(postId: string): Promise<string> {
    const post = await this.artistPostRepository.findOne({
      where: { id: postId },
      select: ['user_id']
    });

    if (!post) {
      throw new HttpException(
        ERROR_MESSAGES.POST_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    return post.user_id;
  }
}
