import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Repository, In, Not } from 'typeorm';
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
import { ArtistPost } from '@artist-post/entities/artist-post.entity';
import {
  AllPostsResponse,
  ArtistPostResponse,
} from '../../artist-post/dto/types';
import { Paginate, PaginationDto } from '@app/types';
import { getPaginated, getPaginatedOutput } from '@app/shared/utils';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Logger } from '@nestjs/common';
import { Post_Type } from '@artist-post/constants';

@Injectable()
export class ArtistPostUserService {
  private readonly logger = new Logger(ArtistPostUserService.name);

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
      this.logger.log(`🎯 [INVITE_CREATE] Creating invite: user=${createArtistPostUserInput.userId}, post=${createArtistPostUserInput.artistPostId}, status=${createArtistPostUserInput.status}`);
      
      // Log the DTO being created
      this.logger.log(`🎯 [INVITE_CREATE] 🔍 DTO details:`, {
        userId: createArtistPostUserInput.userId,
        artistPostId: createArtistPostUserInput.artistPostId,
        status: createArtistPostUserInput.status,
        validTill: createArtistPostUserInput.validTill
      });
      
      const artistPostUserDto = this.artistPostUserMapper.dtoToEntity(
        createArtistPostUserInput,
      );
      
      this.logger.log(`🎯 [INVITE_CREATE] 🔍 Entity to save:`, {
        id: artistPostUserDto.id,
        user_id: artistPostUserDto.user_id,
        artist_post_id: artistPostUserDto.artist_post_id,
        status: artistPostUserDto.status,
        valid_till: artistPostUserDto.valid_till
      });
      
      // Use the upsert method
      const artistPostUser =
        await this.artistPostUserRepository.save(artistPostUserDto);
      
      this.logger.log(`🎯 [INVITE_CREATE] ✅ Invite created successfully with ID: ${artistPostUser.id}`);
      this.logger.log(`🎯 [INVITE_CREATE] ✅ Saved invite details:`, {
        id: artistPostUser.id,
        user_id: artistPostUser.user_id,
        artist_post_id: artistPostUser.artist_post_id,
        status: artistPostUser.status,
        valid_till: artistPostUser.valid_till,
        created_at: artistPostUser.created_at
      });
      
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
      this.logger.log(`🎯 [INVITE_UPDATE] User ${updateArtistPostUserInput.userId} updating invite ${updateArtistPostUserInput.id} to status: ${updateArtistPostUserInput.status}`);
      
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
        this.logger.warn(`🎯 [INVITE_UPDATE] ❌ Invite ${updateArtistPostUserInput.id} not found for user ${updateArtistPostUserInput.userId}`);
        throw new HttpException(
          ERROR_MESSAGES.INVITE_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      
      this.logger.log(`🎯 [INVITE_UPDATE] Found existing invite: post=${existingInvite.artist_post_id}, current status=${existingInvite.status}, new status=${updateArtistPostUserInput.status}`);
      
      if (existingInvite.status === Invite_Status.ACCEPTED) {
        this.logger.warn(`🎯 [INVITE_UPDATE] ❌ Invite ${updateArtistPostUserInput.id} already accepted by user ${updateArtistPostUserInput.userId}`);
        throw new HttpException(`Invite Already Accepted`, HttpStatus.CONFLICT);
      }
      
      const updateDto = this.artistPostUserMapper.dtoToEntityUpdate(
        existingInvite,
        updateArtistPostUserInput,
      );
      // Update the post using save (this will update only the changed fields)
      const artistPostUser =
        await this.artistPostUserRepository.save(updateDto);
      
      this.logger.log(`🎯 [INVITE_UPDATE] ✅ Invite ${updateArtistPostUserInput.id} updated successfully for user ${updateArtistPostUserInput.userId} to status: ${updateArtistPostUserInput.status}`);
      
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
      this.logger.log(`🎯 [INVITE_FETCH] User ${user.id} (${user.full_name || 'Unknown'}) fetching invites. Role: ${user.role[0]}`);
      
      const currentDate = new Date();
      if (user.role[0] === Roles.ARTIST) {
        this.logger.log(`🎯 [INVITE_FETCH] Artist ${user.id} fetching accepted invites for their posts`);
        
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

        this.logger.log(`🎯 [INVITE_FETCH] Artist ${user.id} found ${artistValidInvites.length} accepted invites for their posts`);
        return artistValidInvites;
      } else {
        this.logger.log(`🎯 [INVITE_FETCH] Fan ${user.id} fetching invites to artist posts`);
        
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
        
        this.logger.log(`🎯 [INVITE_FETCH] Fan ${user.id} found ${artistValidInvites.length} invites to artist posts`);
        
        // Log details of each invite
        for (const invite of artistValidInvites) {
          this.logger.log(`🎯 [INVITE_FETCH] Fan ${user.id} has invite to post ${invite.artist_post_id} by artist ${invite.artistPost?.user_id} with status ${invite.status}`);
        }
        
        return this.artistPostUserMapper.processInvitesToAddUser(
          artistValidInvites,
        );
      }
    } catch (err) {
      this.logger.error(`🎯 [INVITE_FETCH] ❌ Error fetching invites for user ${user.id}: ${err?.message}`);
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
        .where('artistPost.user_id = :userId', { userId })
        .andWhere('artistPostUser.status = :status', {
          status: Invite_Status.ACCEPTED,
        })
        .getMany();

      // Return an array of fan user ids (not artist ids)
      return [
        ...new Set(fanOfArtists.map((artist) => artist.user_id)),
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
  async getFansWithAccessToPost(postId: string, excludeUserId?: string): Promise<ArtistPostUser[]> {
    try {
      // First get the post owner ID
      const postOwnerId = await this.getPostOwnerId(postId);
      
      // Check if this is a generic post
      const isGenericPost = await this.artistPostRepository.findOne({
        where: {
          id: postId,
          type: Post_Type.GENERIC
        }
      });

      if (isGenericPost) {
        // For generic posts, get all fans who have ever accepted any post from this artist
        const fans = await this.artistPostUserRepository
          .createQueryBuilder('artistPostUser')
          .leftJoinAndSelect('artistPostUser.artistPost', 'artistPost')
          .where('artistPost.user_id = :postOwnerId', { postOwnerId })
          .andWhere('artistPostUser.user_id != :postOwnerId', { postOwnerId })
          .andWhere('artistPostUser.status = :status', { status: Invite_Status.ACCEPTED })
          .andWhere('artistPostUser.user_id != :excludeUserId', { excludeUserId: excludeUserId || '' })
          .getMany();

        this.logger.log(`[FANS] Found ${fans.length} fans with access to generic post ${postId}`);
        return fans;
      }

      // For regular posts, use the existing logic
      const whereClause: any = {
        artist_post_id: postId,
        status: In([Invite_Status.ACCEPTED, Invite_Status.GENERIC])
      };

      if (excludeUserId) {
        whereClause.user_id = Not(excludeUserId);
      } else {
        whereClause.user_id = Not(postOwnerId);
      }
      
      const fans = await this.artistPostUserRepository.find({
        relations: ['user'],
        where: whereClause
      });

      this.logger.log(`[FANS] Found ${fans.length} fans with access to post ${postId}`);
      return fans;
    } catch (err) {
      this.logger.error(
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

  async verifyUserAccessToPost(userId: string, postId: string): Promise<boolean> {
    try {
      // Get the post to check ownership
      const post = await this.artistPostRepository.findOne({
        where: { id: postId },
        select: ['user_id']
      });

      if (!post) {
        return false;
      }

      // If user is the post owner (artist), they always have access
      if (post.user_id === userId) {
        return true;
      }

      // For non-owners (fans), check if they have an accepted invite
      const postAccess = await this.artistPostUserRepository.findOne({
        where: {
          user_id: userId,
          artist_post_id: postId,
          status: Invite_Status.ACCEPTED
        }
      });

      return !!postAccess;
    } catch (error) {
      this.logger.error(`Error verifying user access to post: ${error.message}`, error.stack);
      return false;
    }
  }
}
