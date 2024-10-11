import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserInput } from '@cognito/dto/types';
import {
  FetchNearByUsersInput,
  UpdateUserLocationAndNotificationInput,
  UpdateUserLocationInput,
  UserUpdateInput,
} from '../dto/types';
import { GlobalServiceResponse } from '@app/shared/types/types';
import { User } from '../entities/user.entity';
import { UserMapper } from '../dto/user.mapper';
import { ERROR_MESSAGES, Roles } from '@app/shared/constants/constants';
import { addMinutesToDate } from '@app/modules/posts/modules/artist-post/utils';
import { ArtistPostService } from '@app/modules/posts/modules/artist-post/services/artist-post.service';
import { Post_Type } from '@app/modules/posts/modules/artist-post/constants';
import { ArtistPostUserService } from '@app/modules/posts/modules/artist-post-user/services/artist-post-user.service';
import { Invite_Status } from '@app/modules/posts/modules/artist-post-user/constants/constants';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private userMapper: UserMapper,
    @Inject(forwardRef(() => ArtistPostService))
    private artistPostService: ArtistPostService,
    private artistPostUserService: ArtistPostUserService,
  ) {}

  /**
   * Create User
   *
   * @param registerUserInput
   * @returns {User}
   */
  async createUser(createUserInput: CreateUserInput): Promise<User> {
    try {
      const existingUser = await this.userRepository.findOne({
        where: { email: createUserInput?.email },
      });

      if (existingUser) {
        throw new HttpException(
          `User with Email: ${createUserInput.email} already exists`,
          HttpStatus.CONFLICT,
        );
      }
      const createUserDto = this.userMapper.dtoToEntity(createUserInput);
      // Ensure the role is an array, as per the entity definition
      const newUser = await this.userRepository.save(createUserDto);
      // await this.userRepository.save(newUser);
      return newUser;
    } catch (error) {
      console.error(
        '🚀 ~ file: user.service.ts:96 ~ UserService ~ registerUser ~ error:',
        error,
      );
      throw error;
    }
  }

  /**
   * Fetch all users
   *
   * @returns {User}
   */
  async fetchAllUsers(): Promise<User[]> {
    try {
      const users: User[] = await this.userRepository.find();
      if (users.length == 0) {
        throw new HttpException(
          ERROR_MESSAGES.USER_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      return users;
    } catch (error) {
      console.error(
        '🚀 ~ file: user.service.ts ~ UserService ~ fetchAllUsers ~ error:',
        error,
      );
      throw error;
    }
  }

  /**
   * Fetch a user for the given Id
   *
   * @param id
   * @returns {User}
   */
  async findUserByUserSub(id: string): Promise<User> {
    try {
      const user: User | null = await this.userRepository.findOne({
        where: { user_sub: id },
      });
      if (!user) {
        throw new HttpException(
          ERROR_MESSAGES.USER_NOT_FOUND,
          HttpStatus.BAD_REQUEST,
        );
      }
      return user;
    } catch (error) {
      console.error(
        '🚀 ~ file: user.service.ts ~ UserService ~ findUserById ~ error:',
        error,
      );
      throw error;
    }
  }

  /**
   * Service to delete User.
   *
   * @param id
   * @returns {boolean}
   */
  async deleteUserById(id: string): Promise<boolean> {
    try {
      const user: User | null = await this.userRepository.findOne({
        where: { id: id },
      });
      if (!user) {
        throw new HttpException(
          ERROR_MESSAGES.USER_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      await this.userRepository.delete({
        id: id,
      });
      return true;
    } catch (err) {
      console.error('🚀 ~ UserService ~ deleteUserById ~ err:', err);
      throw err;
    }
  }

  /**
   * Fetch a user for the given Id
   *
   * @param data
   * @returns {User}
   */
  async findUserByUserEmailOrPhone(data: string): Promise<Boolean> {
    try {
      const user: User | null = await this.userRepository.findOne({
        where: [
          { phone_number: data }, // Search by phone_number
          { email: data }, // Search by email
        ],
      });
      if (user) {
        throw new HttpException(
          `User with this data already exist`,
          HttpStatus.CONFLICT,
        );
      }
      return true;
    } catch (error) {
      console.error(
        '🚀 ~ file: user.service.ts ~ UserService ~ findUserById ~ error:',
        error,
      );
      throw error;
    }
  }

  /**
   * Service to update the user
   * @param userSub
   * @returns {GlobalServiceResponse}
   */
  async updateIsConfirmed(id: string): Promise<GlobalServiceResponse> {
    try {
      // Check if the user already exists
      const existingUser = await this.userRepository.findOne({
        where: { user_sub: id }, // Check based on the user sub id
      });

      if (!existingUser) {
        throw new HttpException(
          `User with ID: ${id} does not exist`,
          HttpStatus.NOT_FOUND,
        );
      }
      existingUser.is_confirmed = true;
      // Update existing user
      const updatedUser = await this.userRepository.save(existingUser);
      const { user_sub, ...rest } = updatedUser;

      return {
        statusCode: 200,
        message: 'User Update Successful',
        data: { ...rest, role: rest.role[0] },
      };
    } catch (error) {
      console.error(
        '🚀 ~ file: user.service.ts:96 ~ UserService ~ updateUser ~ error:',
        error,
      );
      throw new HttpException(
        `User update error: ${error?.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Service to update the user
   * @param userUpdateInput
   * @returns
   */
  async updateUser(
    userUpdateInput: UserUpdateInput,
    id: string,
  ): Promise<GlobalServiceResponse> {
    try {
      // Check if the user already exists
      const existingUser = await this.userRepository.findOne({
        where: { id: id }, // Check based on the user sub id
      });

      if (!existingUser) {
        throw new HttpException(
          `User with ID: ${id} does not exist`,
          HttpStatus.NOT_FOUND,
        );
      }
      const updateUserDto = this.userMapper.dtoToEntityUpdate(
        existingUser,
        userUpdateInput,
      );
      // Update existing user
      const updatedUser = await this.userRepository.save(updateUserDto);
      const { user_sub, ...rest } = updatedUser;

      return {
        statusCode: 200,
        message: 'User Update Successful',
        data: { ...rest, role: rest.role[0] },
      };
    } catch (error) {
      console.error(
        '🚀 ~ file: user.service.ts:96 ~ UserService ~ updateUser ~ error:',
        error,
      );
      throw new HttpException(
        `User update error: ${error?.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Service to update the user
   * @param UpdateUserLocationInput
   * @returns
   */
  async updateUserLocation(
    updateUserLocationInput: UpdateUserLocationInput,
    userId: string,
  ): Promise<GlobalServiceResponse> {
    try {
      // Check if the user already exists
      const existingUser = await this.userRepository.findOne({
        where: { id: userId }, // Check based on the user sub id
      });

      if (!existingUser) {
        throw new HttpException(
          `User with ID: ${userId} does not exist`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Update existing user
      const updatedUser = await this.userRepository.save({
        ...existingUser, // Retain existing properties
        ...updateUserLocationInput, // Overwrite with new values from body
      });
      const { user_sub, ...rest } = updatedUser;

      return {
        statusCode: 200,
        message: 'User Update Successful',
        data: { ...rest, role: rest.role[0] },
      };
    } catch (error) {
      console.error(
        '🚀 ~ file: user.service.ts:96 ~ UserService ~ updateUser ~ error:',
        error,
      );
      throw new HttpException(
        `User update error: ${error?.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Fetch users by role
   *
   * @param {Roles} role
   * @returns {User[]}
   */
  async fetchUsersByRole(role: Roles): Promise<User[]> {
    try {
      const users = await this.userRepository
        .createQueryBuilder('user')
        .where(':role = ANY(user.role)', { role })
        .getMany();
      return users;
    } catch (error) {
      console.error(
        '🚀 ~ file: user.service.ts ~ UserService ~ fetchUsersByRole ~ error:',
        error,
      );
      throw error;
    }
  }

  /**
   * Fetch a user for the given Id
   *
   * @param id
   * @returns {User}
   */
  async findUserById(id: string): Promise<User> {
    try {
      const user: User | null = await this.userRepository.findOne({
        where: { id: id },
      });
      if (!user) {
        throw new HttpException(
          `User with id : ${id} not found`,
          HttpStatus.BAD_REQUEST,
        );
      }
      return user;
    } catch (error) {
      console.error(
        '🚀 ~ file: user.service.ts ~ UserService ~ findUserById ~ error:',
        error,
      );
      throw error;
    }
  }

  /**
   * Fetches the Users near the given coordinates within the given radius.
   *
   * @param fetchNearByUsersInput
   * @returns {FetchNearByStoresResponse[]}
   */
  async fetchNearByUsers(
    fetchNearByUsersInput: FetchNearByUsersInput,
  ): Promise<any> {
    try {
      const { latitude, longitude, radiusInMeters } = fetchNearByUsersInput;
      const queryBuilder = this.userRepository.createQueryBuilder('user');

      const query = queryBuilder
        .select([
          '"user".*',
          `ST_Distance(
      ST_SetSRID(ST_MakePoint(CAST(user.longitude AS DOUBLE PRECISION), CAST(user.latitude AS DOUBLE PRECISION)), 2100),
      ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 2100)
    ) AS distance_in_meters`,
        ])
        .where(`"user"."latitude" <> ''`)
        .andWhere(`"user"."longitude" <> ''`)
        .andWhere(':role = ANY(user.role)', { role: Roles.USER })
        .andWhere('"user"."notifications_enabled" = :status', { status: true }) // Added condition for notification_status
        .andWhere(
          `ST_Distance(
    ST_SetSRID(ST_MakePoint(CAST("user"."longitude" AS DOUBLE PRECISION), CAST("user"."latitude" AS DOUBLE PRECISION)), 2100),
    ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 2100)
  ) <= ${radiusInMeters}`,
        )
        .orderBy(`distance_in_meters`, 'ASC');

      const res = await query.getRawMany();
      return res;
    } catch (error) {
      console.error('🚀 ~ UserService ~ fetchNearByUsers ~ error:', error);
      throw error;
    }
  }

  /**
   * Service to update the user
   * @param UpdateUserLocationInput
   * @returns
   */
  async updateNotificationStatusAndLocation(
    updateUserLocationAndNotificationInput: UpdateUserLocationAndNotificationInput,
    userId: string,
  ): Promise<GlobalServiceResponse> {
    try {
      // Check if the user already exists
      const existingUser = await this.userRepository.findOne({
        where: { id: userId }, // Check based on the user sub id
      });

      if (!existingUser) {
        throw new HttpException(
          `User with ID: ${userId} does not exist`,
          HttpStatus.NOT_FOUND,
        );
      }
      // Update existing user
      const updatedUser = await this.userRepository.save({
        ...existingUser, // Retain existing properties
        notifications_enabled:
          updateUserLocationAndNotificationInput.notificationsEnabled,
        ...updateUserLocationAndNotificationInput, // Overwrite with new values from body
        notification_status_valid_till:
          updateUserLocationAndNotificationInput.notificationsEnabled
            ? addMinutesToDate(new Date(), 20)
            : new Date(),
      });
      if (updateUserLocationAndNotificationInput?.notificationsEnabled) {
        // Fetch the posts that are within the range and send the invites.
        const posts = await this.artistPostService.fetchAllRecentArtistPost(
          15,
          updatedUser?.id,
        );
        const filteredPosts = posts.filter((post) => {
          // Check if artistPostUser array doesn't contain current user and post status is not null
          const hasCurrentUser = post.artistPostUser?.some(
            (apu) => apu.user_id === updatedUser?.id,
          );
          return !hasCurrentUser;
        });
        // Filter posts on basis of location
        for (const post of filteredPosts) {
          const minutesToAdd = post.type === Post_Type.INVITE_PHOTO ? 15 : 5;
          await this.artistPostUserService.createArtistPostUser({
            userId: updatedUser?.id,
            artistPostId: post?.id,
            status: Invite_Status.PENDING,
            validTill: addMinutesToDate(
              new Date(post.created_at),
              minutesToAdd,
            ),
          });
        }
      }
      return {
        statusCode: 200,
        message: 'User Location and invite status update Successful',
        data: '',
      };
    } catch (error) {
      console.error(
        '🚀 ~ file: user.service.ts:96 ~ UserService ~ updateUser ~ error:',
        error,
      );
      throw new HttpException(
        `User update error: ${error?.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /* Disable users notification status having notification_status_valid_till less than current time
   *
   * @returns {Promise<void>}
   */
  @Cron('*/2 * * * *') // Every 2 minutes
  async disableUserNotificationStatus(): Promise<void> {
    try {
      const currentTime = new Date();
      const queryBuilder = this.userRepository.createQueryBuilder('user');

      const query = queryBuilder
        .update(User)
        .set({ notifications_enabled: false })
        .where('role @> :role', { role: [Roles.USER] })
        .andWhere('"user"."notifications_enabled" = :status', { status: true })
        .andWhere('"user"."notification_status_valid_till" < :currentTime', {
          currentTime,
        });

      await query.execute();
    } catch (error) {
      console.error(
        '🚀 ~ UserService ~ disableUserNotificationStatus ~ error:',
        error,
      );
      throw error;
    }
  }
}
