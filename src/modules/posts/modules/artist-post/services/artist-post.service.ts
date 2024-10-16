import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ArtistPost } from '../entities/artist-post.entity';
import {
  AllPostsResponse,
  ArtistPostObject,
  ArtistPostResponse,
  ArtistPostWithCounts,
  CreateArtistPostInput,
  UpdateArtistPostInput,
} from '../dto/types';
import { ArtistPostMapper } from '../dto/artist-post.mapper';
import { UserService } from '@app/modules/user/services/user.service';
import { ERROR_MESSAGES, Roles } from '@app/shared/constants/constants';
import { ArtistPostUserService } from '@artist-post-user/services/artist-post-user.service';
import { Invite_Status } from '../../artist-post-user/constants/constants';
import { addMinutesToDate } from '../utils';
import { User } from '@app/modules/user/entities/user.entity';
import { ArtistPostUser } from '@artist-post-user/entities/artist-post-user.entity';
import { Post_Message, Post_Type } from '../constants';
import { Paginate, PaginationDto } from '@app/types';
import { getPaginated, getPaginatedOutput } from '@app/shared/utils';
import { UpdateUserLocationAndNotificationInput } from '@app/modules/user/dto/types';

@Injectable()
export class ArtistPostService {
  constructor(
    @InjectRepository(ArtistPost)
    private artistPostRepository: Repository<ArtistPost>,
    private artistPostMapper: ArtistPostMapper,
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
    private artistPostUserService: ArtistPostUserService,
  ) {}

  /**
   * Service to create Artist post
   * @param createArtistPostInput
   * @returns {ArtistPostObject}
   */
  async createArtistPost(
    createArtistPostInput: CreateArtistPostInput,
  ): Promise<ArtistPostObject> {
    try {
      const artistPostDto = this.artistPostMapper.dtoToEntity({
        ...createArtistPostInput,
        message: Post_Message,
      });
      // Use the upsert method
      const artistPost = await this.artistPostRepository.save(artistPostDto);
      const users = await this.userService.fetchNearByUsers({
        radiusInMeters: createArtistPostInput.range,
        longitude: Number(createArtistPostInput.longitude),
        latitude: Number(createArtistPostInput.latitude),
      });
      const minutesToAdd = artistPost.type === Post_Type.INVITE_PHOTO ? 15 : 5;
      // Loop on users and add it in artist post user
      for (const user of users) {
        await this.artistPostUserService.createArtistPostUser({
          userId: user?.id,
          artistPostId: artistPost?.id,
          status: Invite_Status.PENDING,
          validTill: addMinutesToDate(
            new Date(artistPost.created_at),
            minutesToAdd,
          ),
        });
      }
      await this.artistPostUserService.createArtistPostUser({
        userId: createArtistPostInput?.userId,
        artistPostId: artistPost?.id,
        status: Invite_Status.NULL,
        validTill: addMinutesToDate(
          new Date(artistPost.created_at),
          minutesToAdd,
        ),
      });
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
   * Service to update the artist post
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
          user_id: updateArtistPostInput.userId,
        },
      });
      // If no post is found, throw an error
      if (!existingPost) {
        throw new HttpException(
          ERROR_MESSAGES.POST_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
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

  /**
   * Service to delete the artist post
   * @param id
   * @param user_id
   * @returns
   */
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
          ERROR_MESSAGES.POST_NOT_FOUND,
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
   * Service to fetch all Artist post
   * @param user_id
   * @returns {ArtistPostObject[]}
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

  /**
   * Service to fetch all Artist post
   * @param user_id
   * @returns {ArtistPostObject[]}
   */
  async fetchPostDataById(
    user: User,
    postId: string,
  ): Promise<ArtistPostResponse> {
    try {
      if (user.role[0] === Roles.ARTIST) {
        const artistPosts = await this.artistPostRepository
          .createQueryBuilder('artistPost')
          .leftJoinAndSelect('artistPost.artistPostUser', 'artistPostUser')
          .leftJoin('artistPostUser.user', 'user')
          .addSelect([
            'user.id',
            'user.full_name',
            'user.email',
            'user.phone_number',
            'user.avatar_url',
            'user.role',
          ]) // Select specific fields from user
          .leftJoinAndSelect('artistPostUser.comment', 'comment')
          .leftJoinAndSelect('artistPostUser.reaction', 'reaction')
          .where('artistPost.user_id = :userId', { userId: user?.id })
          .andWhere('artistPost.id = :postId', { postId })
          .andWhere('artistPostUser.status IN (:...statuses)', {
            statuses: [Invite_Status.ACCEPTED, Invite_Status.NULL], // Filter for both ACCEPTED and NULL statuses
          }) // Filter for accepted status
          .getOne();
        if (!artistPosts) {
          throw new HttpException(
            ERROR_MESSAGES.POST_NOT_FOUND,
            HttpStatus.NOT_FOUND,
          );
        }
        const formattedPostData =
          this.artistPostMapper.processArtistPostData(artistPosts);
        return formattedPostData;
      } else {
        const userPost: ArtistPostResponse =
          await this.artistPostUserService.fetchUserCommentsAndReaction(
            user?.id,
            postId,
          );
        return userPost;
      }
    } catch (error) {
      console.error(
        '🚀 ~ file:artist.post.service.ts:96 ~ ArtistPostService ~ fetchAllArtistPost ~ error:',
        error,
      );
      throw error;
    }
  }

  /**
   * Service to fetch all User data
   * @param user
   * @returns {ArtistPostObject[]}
   */
  async fetchAllUserPostsData(
    user: User,
    req: PaginationDto,
  ): Promise<AllPostsResponse> {
    try {
      if (user?.role[0] === Roles.ARTIST) {
        const paginate: Paginate = getPaginated(
          req.pageNo || 1,
          req.pageSize || 0,
        );
        const [artistPosts, count] =
          await this.artistPostRepository.findAndCount({
            relations: [
              'artistPostUser',
              'artistPostUser.user',
              'artistPostUser.comment',
              'artistPostUser.reaction',
            ],
            where: {
              user_id: user?.id,
            },
            skip: paginate.offset,
            take: paginate.limit,
          });
        const formattedPosts =
          this.artistPostMapper.processArtistPostsData(artistPosts);
        const meta = getPaginatedOutput(
          paginate.pageNo,
          paginate.pageSize,
          count,
        );
        return { posts: formattedPosts, meta };
      } else {
        const paginate: Paginate = getPaginated(
          req.pageNo || 1,
          req.pageSize || 0,
        );
        let formattedPosts: ArtistPostWithCounts[] = [];
        let postCount = 0;
        //Fetch the Post for which user accepts the invites plus comments and likes
        const acceptedPostIds =
          await this.artistPostUserService.fetchAcceptedPostsIds(user?.id);
        if (acceptedPostIds.length) {
          const [artistPosts, count] = await this.artistPostRepository
            .createQueryBuilder('artistPost')
            .leftJoinAndSelect('artistPost.artistPostUser', 'artistPostUser')
            .leftJoinAndSelect('artistPostUser.comment', 'comment')
            .leftJoinAndSelect('artistPostUser.reaction', 'reaction')
            .where('artistPost.id IN (:...acceptedPostIds)', {
              acceptedPostIds,
            }) // Filter by artistPostIds
            .skip(paginate.offset) // Apply pagination offset
            .take(paginate.limit) // Apply pagination limit
            .getManyAndCount();
          formattedPosts =
            this.artistPostMapper.processArtistPostsData(artistPosts);
          postCount = count;
        }
        const meta = getPaginatedOutput(
          paginate.pageNo,
          paginate.pageSize,
          postCount,
        );
        return { posts: formattedPosts, meta };
      }
    } catch (error) {
      console.error(
        '🚀 ~ file:artist.post.service.ts:96 ~ ArtistPostService ~ fetchAllUserPostsData ~ error:',
        error,
      );
      throw error;
    }
  }

  /**
   * Service to fetch all Recent Artist post
   * @param
   * @returns {ArtistPost[]}
   */
  async fetchAllRecentArtistPost(
    interval: number,
    updateUserLocationAndNotificationInput: UpdateUserLocationAndNotificationInput,
  ): Promise<ArtistPost[]> {
    try {
      const { longitude, latitude } = updateUserLocationAndNotificationInput;
      const artistPosts = await this.artistPostRepository
        .createQueryBuilder('artistPost')
        .leftJoinAndSelect('artistPost.artistPostUser', 'artistPostUser')
        // Filter recent posts based on the interval
        .andWhere(
          `artistPost.created_at >= NOW() - INTERVAL '${interval} minutes'`,
        )
        .andWhere(`"artistPost"."latitude" <> ''`)
        .andWhere(`"artistPost"."longitude" <> ''`)
        .andWhere(
          `ST_DistanceSphere(
            ST_MakePoint(CAST(artistPost.longitude AS DOUBLE PRECISION), CAST(artistPost.latitude AS DOUBLE PRECISION)),
            ST_MakePoint(${longitude}, ${latitude})
          ) <= artistPost.range`, // This checks if users are within the radius
        )
        .getMany();
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
