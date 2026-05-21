import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media_Type } from '@app/types';
import { ArtistPost } from '../entities/artist-post.entity';
import {
  AllPostsResponse,
  ArtistPostObject,
  ArtistPostResponse,
  ArtistPostWithCounts,
  CreateArtistPostInput,
  CreateGenericArtistPostInput,
  GenericArtistPostObject,
  UpdateArtistPostInput,
} from '../dto/types';
import { ArtistPostMapper } from '../dto/artist-post.mapper';
import { UserService } from '@app/modules/user/services/user.service';
import { ERROR_MESSAGES, Roles } from '@app/shared/constants/constants';
import { ArtistPostUserService } from '@artist-post-user/services/artist-post-user.service';
import { Invite_Status } from '../../artist-post-user/constants/constants';
import { addMinutesToDate } from '../utils';
import { User } from '@app/modules/user/entities/user.entity';
import { Post_Message, Post_Type } from '../constants';
import { Paginate, PaginationDto } from '@app/types';
import { getPaginated, getPaginatedOutput } from '@app/shared/utils';
import { UpdateUserLocationAndNotificationInput } from '@app/modules/user/dto/types';
import { CommentsService } from '@comments/services/commnets.service';
import { Comments } from '@comments/entities/comments.entity';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class ArtistPostService {
  private readonly logger = new Logger(ArtistPostService.name);

  constructor(
    @InjectRepository(ArtistPost)
    private artistPostRepository: Repository<ArtistPost>,
    private artistPostMapper: ArtistPostMapper,
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
    private artistPostUserService: ArtistPostUserService,
    private commentService: CommentsService,
    @InjectQueue('merch-creation')
    private merchCreationQueue: Queue,
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
        message: createArtistPostInput?.message || Post_Message,
      });
      // Use the upsert method
      const artistPost = await this.artistPostRepository.save(artistPostDto);
      
      this.logger.log(`🎯 [INVITE_CREATION] Creating invites for artist post ${artistPost.id} by user ${createArtistPostInput?.userId}`);
      this.logger.log(`🎯 [INVITE_CREATION] Post details: type=${createArtistPostInput.type}, range=${createArtistPostInput.range}m, location=(${createArtistPostInput.latitude}, ${createArtistPostInput.longitude})`);
      
      // Log the exact parameters being sent to fetchNearByUsers
      this.logger.log(`🎯 [INVITE_CREATION] 🔍 Calling fetchNearByUsers with: radius=${createArtistPostInput.range}m, lat=${createArtistPostInput.latitude}, lng=${createArtistPostInput.longitude}, excludeUser=${createArtistPostInput?.userId}`);
      
      const users = await this.userService.fetchNearByUsers({
        radiusInMeters: createArtistPostInput.range,
        longitude: Number(createArtistPostInput.longitude),
        latitude: Number(createArtistPostInput.latitude),
        currentUserId: createArtistPostInput?.userId,
      });
      
      this.logger.log(`🎯 [INVITE_CREATION] Found ${users.length} nearby users within ${createArtistPostInput.range}m radius`);
      
      // Log detailed information about each user found
      if (users.length > 0) {
        this.logger.log(`🎯 [INVITE_CREATION] 📍 Users found within range:`);
        users.forEach((user, index) => {
          this.logger.log(`🎯 [INVITE_CREATION]   ${index + 1}. User ${user.id} (${user.full_name || 'Unknown'}) at distance ${user.distance_in_meters?.toFixed(2)}m`);
        });
      } else {
        this.logger.warn(`🎯 [INVITE_CREATION] ⚠️ NO USERS FOUND within ${createArtistPostInput.range}m radius! This might indicate a distance conversion issue.`);
        this.logger.warn(`🎯 [INVITE_CREATION] ⚠️ Check if range ${createArtistPostInput.range} is in the correct unit (meters vs feet)`);
      }
      
      // Drop timer: artist picks how long the drop stays open. Default 4 hours
      // (matches the UI default) when the field is missing. Clamp to a sane
      // range so a typo can't create a drop that never closes.
      const requested = (createArtistPostInput as any).dropDurationMinutes;
      const minutesToAdd = (typeof requested === 'number' && requested > 0)
        ? Math.min(requested, 60 * 24 * 7) // hard cap at 7 days
        : 4 * 60;
      // Loop on users and add it in artist post user
      for (const user of users) {
        this.logger.log(`🎯 [INVITE_CREATION] Creating invite for user ${user.id} (${user.full_name || 'Unknown'}) at distance ${user.distance_in_meters?.toFixed(2)}m`);
        
        try {
          const invite = await this.artistPostUserService.createArtistPostUser({
            userId: user?.id,
            artistPostId: artistPost?.id,
            status: Invite_Status.PENDING,
            validTill: addMinutesToDate(
              new Date(artistPost.created_at),
              minutesToAdd,
            ),
          });
          
          this.logger.log(`🎯 [INVITE_CREATION] ✅ Invite created successfully for user ${user.id} - expires in ${minutesToAdd} minutes (~6 hours)`);
          this.logger.log(`🎯 [INVITE_CREATION] 🔍 Created invite details: ${JSON.stringify({
            id: invite.id,
            user_id: invite.user_id,
            artist_post_id: invite.artist_post_id,
            status: invite.status,
            valid_till: invite.valid_till
          })}`);
        } catch (error) {
          this.logger.error(`🎯 [INVITE_CREATION] ❌ Failed to create invite for user ${user.id}: ${error?.message}`);
          throw error;
        }
      }
      
      await this.artistPostUserService.createArtistPostUser({
        userId: createArtistPostInput?.userId,
        artistPostId: artistPost?.id,
        status: Invite_Status.GENERIC,
        validTill: addMinutesToDate(
          new Date(artistPost.created_at),
          minutesToAdd,
        ),
      });
      
      this.logger.log(`🎯 [INVITE_CREATION] ✅ Artist post ${artistPost.id} created with ${users.length} invites sent to nearby users`);
      
      // Final summary log
      this.logger.log(`🎯 [INVITE_CREATION] 🎉 INVITE CREATION SUMMARY:`);
      this.logger.log(`🎯 [INVITE_CREATION]   - Post ID: ${artistPost.id}`);
      this.logger.log(`🎯 [INVITE_CREATION]   - Artist: ${createArtistPostInput?.userId}`);
      this.logger.log(`🎯 [INVITE_CREATION]   - Range: ${createArtistPostInput.range}m`);
      this.logger.log(`🎯 [INVITE_CREATION]   - Location: (${createArtistPostInput.latitude}, ${createArtistPostInput.longitude})`);
      this.logger.log(`🎯 [INVITE_CREATION]   - Users found: ${users.length}`);
      this.logger.log(`🎯 [INVITE_CREATION]   - Invites created: ${users.length}`);
      this.logger.log(`🎯 [INVITE_CREATION]   - Invite expiry: ${minutesToAdd} minutes (~6 hours)`);
      
      if (users.length === 0) {
        this.logger.warn(`🎯 [INVITE_CREATION] ⚠️ CRITICAL: No invites were created!`);
        this.logger.warn(`🎯 [INVITE_CREATION] ⚠️ This means no users were found within ${createArtistPostInput.range}m radius`);
        this.logger.warn(`🎯 [INVITE_CREATION] ⚠️ Check the logs above for detailed debugging information`);
      }
      
      // Automated Merch Drop: if the artist enabled the toggle and this is a
      // photo drop, schedule a delayed BullMQ job that triggers the merch
      // pipeline `merchDelayMinutes` after the drop went live. The delay is
      // independent of the drop's own duration, so a multi-day festival drop
      // can still fire its merch offer 15 minutes after the autograph lands.
      const input = createArtistPostInput as any;
      const isPhotoDrop = createArtistPostInput.type === Post_Type.INVITE_PHOTO;
      if (input.automatedMerchDrop === true && isPhotoDrop) {
        const merchDelayMinutes = typeof input.merchDelayMinutes === 'number'
          ? Math.max(0, Math.min(input.merchDelayMinutes, 60 * 24))
          : 15;
        try {
          await this.merchCreationQueue.add(
            'start-merch-drop',
            {
              kind: 'start-merch-drop',
              artistId: createArtistPostInput.userId,
              artistPostId: artistPost.id,
              merchDurationMinutes: input.dropDurationMinutes,
            },
            { delay: merchDelayMinutes * 60 * 1000, attempts: 2 },
          );
          this.logger.log(`🛍️ [AUTO_MERCH] Scheduled merch drop for post ${artistPost.id} in ${merchDelayMinutes} minutes`);
        } catch (err: any) {
          this.logger.error(`🛍️ [AUTO_MERCH] Failed to schedule merch drop for post ${artistPost.id}: ${err?.message}`);
        }
      }

      const { user_id, ...rest } = artistPost;
      return rest;
    } catch (error) {
      this.logger.error(`🎯 [INVITE_CREATION] ❌ Error creating artist post: ${error?.message}`);
      throw new HttpException(` ${error?.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Service to send a generic message.
   * This function checks if a generic message post already exists for the given user ID.
   * If it does, it adds a comment to the existing post. If not, it creates a new generic message post.
   * @param createGenericArtistPostInput The input containing the user ID and the message to be sent.
   * @returns A GenericArtistPostObject containing the generic message post details.
   * @throws An HttpException with status code 400 and the error message if an error occurs during the process.
   */
  async sendGenericMessage(
    createGenericArtistPostInput: CreateGenericArtistPostInput,
  ): Promise<GenericArtistPostObject> {
    try {
      // Always create a NEW post per upload. The Flutter UI presents each
      // photo/video as a standalone post and the feed renders posts, not
      // comments — so the old "first post becomes the artist's wall, rest
      // become comments" logic silently lost media on every upload after
      // the first one. Each upload is now its own first-class feed item.
      const artistPostDto = this.artistPostMapper.dtoToEntityGenericMessage({
        ...createGenericArtistPostInput,
      });
      const artistPost = await this.artistPostRepository.save(artistPostDto);
      await this.artistPostUserService.createArtistPostUser({
        userId: createGenericArtistPostInput?.userId,
        artistPostId: artistPost?.id,
        status: Invite_Status.GENERIC,
        validTill: null,
      });
      const { user_id, ...rest } = artistPost;
      return rest;
    } catch (error) {
      console.error(
        '🚀 ~ file:artist.post.service.ts ~ ArtistPostService ~ sendGenericMessage ~ error:',
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
   * Service to fetch all Artist's generic post IDs.
   * This function fetches the IDs of all generic posts made by the artists specified in the `artistIds` array.
   * @param artistIds - An array of IDs of artists whose generic posts are to be fetched.
   * @returns A Promise that resolves to an array of strings, where each string is the ID of a generic post made by one of the specified artists.
   * @throws An error if there is a problem fetching the generic post IDs.
   */
  async fetchArtistsGenericPostsIds(artistIds: string[]): Promise<string[]> {
    try {
      const artistGenericPosts: ArtistPostObject[] =
        await this.artistPostRepository
          .createQueryBuilder('artistPost')
          .where('artistPost.user_id IN (:...artistIds)', {
            artistIds,
          })
          .andWhere('artistPost.type = :type', {
            type: Post_Type.GENERIC,
          })
          .getMany();
      return artistGenericPosts.map((post) => post.id);
    } catch (error) {
      console.error(
        '🚀 ~ file:artist.post.service.ts:96 ~ ArtistPostService ~ fetchArtistsGenericPostsIds ~ error:',
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
          .addSelect(
            `COUNT(CASE WHEN artistPostUser.status = '${Invite_Status.ACCEPTED}' THEN 1 END)`,
            'associate_fan_count',
          )
          .where('artistPost.user_id = :userId', { userId: user?.id })
          .andWhere('artistPost.id = :postId', { postId })
          .andWhere('artistPostUser.status IN (:...statuses)', {
            statuses: [
              Invite_Status.ACCEPTED,
              Invite_Status.GENERIC,
            ],
          })
          .groupBy('artistPost.id')
          .addGroupBy('artistPostUser.id')
          .addGroupBy('user.id')
          .addGroupBy('comment.id')
          .addGroupBy('commentedUser.id')
          .addGroupBy('reaction.id')
          .addGroupBy('reactedUser.id')
          .addGroupBy('commentReaction.id')
          .getOne();

        if (!artistPosts) {
          throw new HttpException(
            ERROR_MESSAGES.POST_NOT_FOUND,
            HttpStatus.NOT_FOUND,
          );
        }
        const formattedPostData =
          await this.artistPostMapper.processArtistPostData(artistPosts);
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
      const paginate: Paginate = getPaginated(req.pageNo || 1, req.pageSize || 0);
      const [artistPosts, count] = await this.artistPostRepository.findAndCount({
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
      const formattedPosts = await this.artistPostMapper.processArtistPostsData(artistPosts);
      const meta = getPaginatedOutput(paginate.pageNo, paginate.pageSize, count);
      return { posts: formattedPosts, meta };
    } else {
      const paginate: Paginate = getPaginated(req.pageNo || 1, req.pageSize || 0);
      let formattedPosts: ArtistPostWithCounts[] = [];
      let postCount = 0;

      // Fetch the Post for which the user accepts the invites plus comments and likes
      let acceptedPostIds = await this.artistPostUserService.fetchAcceptedPostsIds(user?.id);

      const fanOfArtistIds = await this.artistPostUserService.fetchFanOfArtistsGenericPostsIds(user.id);

      if (fanOfArtistIds.length > 0) {
        const fanOfArtistsGenericPostsIds = await this.fetchArtistsGenericPostsIds(fanOfArtistIds);
        acceptedPostIds = [...acceptedPostIds, ...fanOfArtistsGenericPostsIds];
      }

      if (acceptedPostIds.length) {
        const [artistPosts, count] = await this.artistPostRepository
          .createQueryBuilder('artistPost')
          .leftJoin('artistPost.user', 'user')
          .addSelect([
            'user.id',
            'user.full_name',
            'user.email',
            'user.phone_number',
            'user.avatar_url',
          ]) // Select specific fields from user
          .leftJoinAndSelect('artistPost.artistPostUser', 'artistPostUser')
          .leftJoinAndSelect('artistPostUser.comment', 'comment')
          .leftJoinAndSelect('artistPostUser.reaction', 'reaction')
          .where('artistPost.id IN (:...acceptedPostIds)', {
            acceptedPostIds,
          }) // Filter by artistPostIds
          .leftJoin(
            'blocks',
            'block',
            `
              (block.blocked_by = :currentUserId AND block.blocked_user = user.id)
              OR
              (block.blocked_user = :currentUserId AND block.blocked_by = user.id)
            `,
            { currentUserId: user?.id },
          )
          .andWhere('block.id IS NULL') // Exclude blocked users
          .groupBy('artistPost.id') // Group by artistPost.id
          .addGroupBy('user.id') // Add group by for selected user fields
          .addGroupBy('user.full_name')
          .addGroupBy('user.email')
          .addGroupBy('user.phone_number')
          .addGroupBy('user.avatar_url')
          .addGroupBy('artistPostUser.id') // Add group by for joined entities
          .addGroupBy('comment.id')
          .addGroupBy('reaction.id')
          .skip(paginate.offset) // Apply pagination offset
          .take(paginate.limit) // Apply pagination limit
          .getManyAndCount();
        
        formattedPosts = await this.artistPostMapper.processArtistPostsData(artistPosts);
        postCount = count;
      }

      const meta = getPaginatedOutput(paginate.pageNo, paginate.pageSize, postCount);
      return { posts: formattedPosts, meta };
    }
  } catch (error) {
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
      
      this.logger.log(`🎯 [RECENT_POSTS] Searching for recent posts within ${interval} minutes near (${longitude}, ${latitude})`);
      
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
      
      this.logger.log(`🎯 [RECENT_POSTS] Found ${artistPosts.length} recent posts within range of (${longitude}, ${latitude})`);
      
      // Log details of each post found
      for (const post of artistPosts) {
        this.logger.log(`🎯 [RECENT_POSTS] Post ${post.id} by artist ${post.user_id} at (${post.latitude}, ${post.longitude}) with range ${post.range}m`);
      }
      
      return artistPosts;
    } catch (error) {
      this.logger.error(`🎯 [RECENT_POSTS] ❌ Error fetching recent posts: ${error?.message}`);
      throw error;
    }
  }
}
