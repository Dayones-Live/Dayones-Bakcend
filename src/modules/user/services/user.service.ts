import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
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
import { ArtistPost } from '@app/modules/posts/modules/artist-post/entities/artist-post.entity';
import { ArtistPostUserService } from '@app/modules/posts/modules/artist-post-user/services/artist-post-user.service';
import { Invite_Status } from '@app/modules/posts/modules/artist-post-user/constants/constants';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(ArtistPost)
    private artistPostRepository: Repository<ArtistPost>,
    private userMapper: UserMapper,
    @Inject(forwardRef(() => ArtistPostService))
    private artistPostService: ArtistPostService,
    @Inject(forwardRef(() => ArtistPostUserService))
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
      // 1. Try to find by user_sub
      if (createUserInput.userSub) {
        const existingBySub = await this.userRepository.findOne({ where: { user_sub: createUserInput.userSub } });
        if (existingBySub) {
          return existingBySub;
        }
      }

      // 2. Try to find by email
      const existingByEmail = await this.userRepository.findOne({ where: { email: createUserInput.email } });
      if (existingByEmail) {
        // If user_sub is missing or different, update it
        if (!existingByEmail.user_sub || existingByEmail.user_sub !== createUserInput.userSub) {
          existingByEmail.user_sub = createUserInput.userSub;
          await this.userRepository.save(existingByEmail);
        }
        return existingByEmail;
      }

      // 3. Create new user
      const createUserDto = this.userMapper.dtoToEntity(createUserInput);
      const newUser = await this.userRepository.save(createUserDto);
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
        where: { user_sub: id, is_deleted: false },
      });
      if (!user) {
        throw new HttpException(
          ERROR_MESSAGES.USER_DELETED_ERROR,
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
  async checkUserActiveByEmail(data: string): Promise<User | null> {
    try {
      const user: User | null = await this.userRepository.findOne({
        where: [
          { email: data, is_deleted: true }, // Search by email
        ],
      });
      if (user) {
        throw new HttpException(
          ERROR_MESSAGES.USER_DELETED,
          HttpStatus.NOT_FOUND,
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
          ERROR_MESSAGES.USER_NOT_FOUND,
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
          ERROR_MESSAGES.USER_NOT_FOUND,
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

      this.logger.log(`🎯 [LOCATION_UPDATE] User ${userId} (${existingUser.full_name || 'Unknown'}) updating location to (${updateUserLocationInput.latitude}, ${updateUserLocationInput.longitude})`);

      // Update existing user
      const updatedUser = await this.userRepository.save({
        ...existingUser, // Retain existing properties
        ...updateUserLocationInput, // Overwrite with new values from body
      });

      // BIDIRECTIONAL INVITE DISCOVERY: Find nearby posts and create invites
      this.logger.log(`🎯 [LOCATION_UPDATE] 🔍 Starting invite discovery for user ${userId} at location (${updateUserLocationInput.latitude}, ${updateUserLocationInput.longitude})`);
      const discoveryResult = await this.discoverAndCreateInvitesForUser(userId, updateUserLocationInput);
      this.logger.log(`🎯 [LOCATION_UPDATE] 🎉 Invite discovery completed: ${discoveryResult.invitesCreated} invites created from ${discoveryResult.nearbyPostsFound} nearby posts`);

      const { user_sub, ...rest } = updatedUser;

      return {
        statusCode: 200,
        message: 'User Update Successful',
        data: { 
          ...rest, 
          role: rest.role[0],
          locationUpdated: true,
          invitesCreated: discoveryResult.invitesCreated,
          nearbyPostsFound: discoveryResult.nearbyPostsFound
        },
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
   * Fetch pending artist approvals
   *
   * @returns {User[]}
   */
  async fetchPendingArtistApprovals(): Promise<User[]> {
    try {
      const users = await this.userRepository
        .createQueryBuilder('user')
        .where(':role = ANY(user.role)', { role: Roles.ARTIST })
        .andWhere('user.pending_approval = :pending', { pending: true })
        .getMany();
      return users;
    } catch (error) {
      console.error(
        '🚀 ~ file: user.service.ts ~ UserService ~ fetchPendingArtistApprovals ~ error:',
        error,
      );
      throw error;
    }
  }

  /**
   * Approve artist registration
   *
   * @param {string} userId
   * @param {string} adminId
   * @returns {GlobalServiceResponse}
   */
  async approveArtist(userId: string, adminId: string): Promise<GlobalServiceResponse> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        throw new HttpException(
          ERROR_MESSAGES.USER_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }

      if (!user.role.includes(Roles.ARTIST)) {
        throw new HttpException(
          'User is not an artist',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!user.pending_approval) {
        throw new HttpException(
          'User is already approved',
          HttpStatus.BAD_REQUEST,
        );
      }

      user.pending_approval = false;
      user.is_confirmed = true; // Complete the registration
      await this.userRepository.save(user);

      const { user_sub, ...rest } = user;
      return {
        statusCode: 200,
        message: 'Artist approved successfully',
        data: { ...rest, role: rest.role[0] },
      };
    } catch (error) {
      console.error(
        '🚀 ~ file: user.service.ts ~ UserService ~ approveArtist ~ error:',
        error,
      );
      throw error;
    }
  }

  /**
   * Reject artist registration
   *
   * @param {string} userId
   * @param {string} adminId
   * @returns {GlobalServiceResponse}
   */
  async rejectArtist(userId: string, adminId: string): Promise<GlobalServiceResponse> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        throw new HttpException(
          ERROR_MESSAGES.USER_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }

      if (!user.role.includes(Roles.ARTIST)) {
        throw new HttpException(
          'User is not an artist',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!user.pending_approval) {
        throw new HttpException(
          'User is already approved',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Remove artist role and set as regular user
      user.role = [Roles.USER];
      user.pending_approval = false;
      await this.userRepository.save(user);

      const { user_sub, ...rest } = user;
      return {
        statusCode: 200,
        message: 'Artist rejected successfully',
        data: { ...rest, role: rest.role[0] },
      };
    } catch (error) {
      console.error(
        '🚀 ~ file: user.service.ts ~ UserService ~ rejectArtist ~ error:',
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
      const { latitude, longitude, radiusInMeters, currentUserId } =
        fetchNearByUsersInput;
      
      this.logger.log(`🎯 [NEARBY_USERS] Searching for users near (${latitude}, ${longitude}) within ${radiusInMeters}m radius. Excluding user: ${currentUserId}`);
      this.logger.log(`🎯 [NEARBY_USERS] 🔍 Query parameters: lat=${latitude}, lng=${longitude}, radius=${radiusInMeters}m`);
      
      const queryBuilder = this.userRepository.createQueryBuilder('user');
      
      // Log the filtering criteria
      this.logger.log(`🎯 [NEARBY_USERS] 🔍 Filtering criteria:`);
      this.logger.log(`🎯 [NEARBY_USERS]   - Users must have USER role (not ARTIST)`);
      this.logger.log(`🎯 [NEARBY_USERS]   - Users must have notifications enabled`);
      this.logger.log(`🎯 [NEARBY_USERS]   - Users must have valid coordinates (lat/lng not empty)`);
      this.logger.log(`🎯 [NEARBY_USERS]   - Users must be within ${radiusInMeters}m radius`);
      this.logger.log(`🎯 [NEARBY_USERS]   - Users must not be blocked by ${currentUserId}`);
      
      const query = queryBuilder
        .select([
          '"user".*',
          `ST_DistanceSphere(
            ST_MakePoint(CAST(user.longitude AS DOUBLE PRECISION), CAST(user.latitude AS DOUBLE PRECISION)),
            ST_MakePoint(${longitude}, ${latitude})
          ) AS distance_in_meters`,
        ])
        .leftJoin(
          'blocks',
          'block',
          `
            (block.blocked_by = :currentUserId AND block.blocked_user = "user".id)
            OR
            (block.blocked_user = :currentUserId AND block.blocked_by = "user".id)
          `,
          { currentUserId },
        )
        .where(`"user"."latitude" <> ''`)
        .andWhere(`"user"."longitude" <> ''`)
        .andWhere(':role = ANY(user.role)', { role: Roles.USER })
        .andWhere('"user"."notifications_enabled" = :status', { status: true })
        .andWhere(
          `ST_DistanceSphere(
            ST_MakePoint(CAST(user.longitude AS DOUBLE PRECISION), CAST(user.latitude AS DOUBLE PRECISION)),
            ST_MakePoint(${longitude}, ${latitude})
          ) <= ${radiusInMeters}`, // This checks if users are within the radius
        )
        .andWhere('block.id IS NULL') // Exclude blocked users
        .orderBy(`distance_in_meters`, 'ASC');

      // Log the SQL query for debugging
      const sqlQuery = query.getSql();
      this.logger.log(`🎯 [NEARBY_USERS] 🔍 SQL Query: ${sqlQuery}`);
      
      // First, let's check if there are any users in the database at all
      const totalUsers = await this.userRepository.count();
      const usersWithCoords = await this.userRepository.count({
        where: [
          { latitude: Not('') },
          { latitude: Not(null) },
          { longitude: Not('') },
          { longitude: Not(null) }
        ]
      });
      
      // Fix the role query - use the correct array syntax for PostgreSQL
      const usersWithUserRole = await this.userRepository
        .createQueryBuilder('user')
        .where(':role = ANY(user.role)', { role: Roles.USER })
        .getCount();
      
      const usersWithNotifications = await this.userRepository.count({
        where: { notifications_enabled: true }
      });
      
      this.logger.log(`🎯 [NEARBY_USERS] 📊 Database statistics:`);
      this.logger.log(`🎯 [NEARBY_USERS]   - Total users: ${totalUsers}`);
      this.logger.log(`🎯 [NEARBY_USERS]   - Users with coordinates: ${usersWithCoords}`);
      this.logger.log(`🎯 [NEARBY_USERS]   - Users with USER role: ${usersWithUserRole}`);
      this.logger.log(`🎯 [NEARBY_USERS]   - Users with notifications enabled: ${usersWithNotifications}`);
      
      const res = await query.getRawMany();
      
      this.logger.log(`🎯 [NEARBY_USERS] Found ${res.length} eligible users within ${radiusInMeters}m radius`);
      
      if (res.length === 0) {
        this.logger.warn(`🎯 [NEARBY_USERS] ⚠️ NO USERS FOUND! Possible issues:`);
        this.logger.warn(`🎯 [NEARBY_USERS] ⚠️ 1. Radius too small (${radiusInMeters}m might be too restrictive)`);
        this.logger.warn(`🎯 [NEARBY_USERS] ⚠️ 2. No users with USER role in the area`);
        this.logger.warn(`🎯 [NEARBY_USERS] ⚠️ 3. No users with notifications enabled`);
        this.logger.warn(`🎯 [NEARBY_USERS] ⚠️ 4. All nearby users are blocked`);
        this.logger.warn(`🎯 [NEARBY_USERS] ⚠️ 5. Distance unit mismatch (meters vs feet)`);
      }
      
      // Log details of each user found
      for (const user of res) {
        this.logger.log(`🎯 [NEARBY_USERS] User ${user.id} (${user.full_name || 'Unknown'}) at distance ${user.distance_in_meters?.toFixed(2)}m`);
      }
      
      // Additional debugging: Check if the current user is in the results
      const currentUserInResults = res.find(user => user.id === currentUserId);
      if (currentUserInResults) {
        this.logger.log(`🎯 [NEARBY_USERS] ✅ Current user ${currentUserId} IS in the nearby users list`);
      } else {
        this.logger.log(`🎯 [NEARBY_USERS] ❌ Current user ${currentUserId} is NOT in the nearby users list`);
        
        // Let's check why the current user isn't included
        const currentUser = await this.userRepository.findOne({
          where: { id: currentUserId },
          select: ['id', 'full_name', 'role', 'latitude', 'longitude', 'notifications_enabled']
        });
        
        if (currentUser) {
          this.logger.log(`🎯 [NEARBY_USERS] 🔍 Current user details:`, {
            id: currentUser.id,
            full_name: currentUser.full_name,
            role: currentUser.role,
            latitude: currentUser.latitude,
            longitude: currentUser.longitude,
            notifications_enabled: currentUser.notifications_enabled
          });
          
          // Check each criteria
          if (!currentUser.latitude || !currentUser.longitude) {
            this.logger.warn(`🎯 [NEARBY_USERS] ⚠️ Current user has no coordinates: lat=${currentUser.latitude}, lng=${currentUser.longitude}`);
          }
          if (!currentUser.role.includes(Roles.USER)) {
            this.logger.warn(`🎯 [NEARBY_USERS] ⚠️ Current user role is not USER: ${currentUser.role}`);
          }
          if (!currentUser.notifications_enabled) {
            this.logger.warn(`🎯 [NEARBY_USERS] ⚠️ Current user notifications disabled: ${currentUser.notifications_enabled}`);
          }
        } else {
          this.logger.warn(`🎯 [NEARBY_USERS] ⚠️ Current user ${currentUserId} not found in database`);
        }
      }
      
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
      
      this.logger.log(`🎯 [LOCATION_UPDATE] User ${userId} (${existingUser.full_name || 'Unknown'}) updating location to (${updateUserLocationAndNotificationInput.latitude}, ${updateUserLocationAndNotificationInput.longitude})`);
      this.logger.log(`🎯 [LOCATION_UPDATE] Notifications enabled: ${updateUserLocationAndNotificationInput.notificationsEnabled}`);
      
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
      
      // BIDIRECTIONAL INVITE DISCOVERY: Find nearby posts and create invites
      // This works regardless of notification status - we check notifications in the discovery method
      const discoveryResult = await this.discoverAndCreateInvitesForUser(userId, updateUserLocationAndNotificationInput);
      
      return {
        statusCode: 200,
        message: 'User Location and invite status update Successful',
        data: {
          locationUpdated: true,
          invitesCreated: discoveryResult.invitesCreated,
          nearbyPostsFound: discoveryResult.nearbyPostsFound
        },
      };
    } catch (error) {
      this.logger.error(`🎯 [LOCATION_UPDATE] ❌ Error updating user location: ${error?.message}`);
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

      //await query.execute();
    } catch (error) {
      console.error(
        '🚀 ~ UserService ~ disableUserNotificationStatus ~ error:',
        error,
      );
      throw error;
    }
  }

  /**
   * Service to delete the user
   *
   * @param id
   * @returns {Boolean}
   *
   * @throws Error if user not found or already deleted
   */
  async deleteCurrentLoggedInUser(id: string): Promise<Boolean> {
    try {
      // Check if the user exists
      const existingUser = await this.userRepository.findOne({
        where: { id: id },
      });
      if (!existingUser) {
        throw new HttpException(
          ERROR_MESSAGES.USER_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      if (existingUser?.is_deleted === true) {
        throw new HttpException(
          ERROR_MESSAGES.USER_ALREADY_DELETED,
          HttpStatus.NOT_FOUND,
        );
      }
      const updateUserDto = this.userMapper.dtoToEntityUpdate(existingUser, {
        isDeleted: true,
      });
      // Update existing user
      await this.userRepository.save(updateUserDto);
      return true;
    } catch (error) {
      console.error(
        '🚀 ~ file: user.service.ts:96 ~ UserService ~ updateUser ~ error:',
        error,
      );
      throw new HttpException(`${error?.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Fetch a user by email
   *
   * @param email
   * @returns {User}
   */
  async findUserByEmail(email: string): Promise<User> {
    try {
      const user: User | null = await this.userRepository.findOne({
        where: { email: email, is_deleted: false },
      });
      if (!user) {
        throw new HttpException(
          ERROR_MESSAGES.USER_DELETED_ERROR,
          HttpStatus.BAD_REQUEST,
        );
      }
      return user;
    } catch (error) {
      console.error(
        '🚀 ~ file: user.service.ts ~ UserService ~ findUserByEmail ~ error:',
        error,
      );
      throw error;
    }
  }

  /**
   * BIDIRECTIONAL INVITE DISCOVERY: Find nearby posts and create invites for late-arriving users
   * This solves the concert scenario where users arrive after the post is created
   */
  private async discoverAndCreateInvitesForUser(
    userId: string,
    locationInput: UpdateUserLocationInput,
  ): Promise<{ invitesCreated: number; nearbyPostsFound: number }> {
    try {
      this.logger.log(`🎯 [BIDIRECTIONAL_DISCOVERY] Starting invite discovery for user ${userId} at location (${locationInput.latitude}, ${locationInput.longitude})`);

      // Get user details to check role and notifications
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'role', 'notifications_enabled', 'full_name']
      });

      if (!user) {
        this.logger.warn(`🎯 [BIDIRECTIONAL_DISCOVERY] ❌ User ${userId} not found`);
        return;
      }

      // Only create invites for users with USER role and notifications enabled
      if (!user.role.includes(Roles.USER) || !user.notifications_enabled) {
        this.logger.log(`🎯 [BIDIRECTIONAL_DISCOVERY] ⚠️ User ${userId} (${user.full_name}) has role ${user.role} and notifications ${user.notifications_enabled} - skipping invite discovery`);
        return;
      }

      // Find all active posts within a reasonable radius (using a larger radius for discovery)
      const discoveryRadius = 5000; // 5km radius for discovery (larger than typical post radius)
      const currentTime = new Date();

      this.logger.log(`🎯 [BIDIRECTIONAL_DISCOVERY] 🔍 Searching for INVITE_ONLY and INVITE_PHOTO posts within ${discoveryRadius}m radius of (${locationInput.latitude}, ${locationInput.longitude})`);

      const nearbyPosts = await this.artistPostRepository
        .createQueryBuilder('post')
        .leftJoin('post.user', 'artist')
        .addSelect(['artist.id', 'artist.full_name'])
        .where('post.type IN (:...types)', { types: [Post_Type.INVITE_ONLY, Post_Type.INVITE_PHOTO] })
        .andWhere('post.created_at > :recentTime', { 
          recentTime: new Date(currentTime.getTime() - 24 * 60 * 60 * 1000) // Only posts from last 24 hours
        })
        .andWhere(`ST_DistanceSphere(
          ST_MakePoint(CAST(:userLng AS DOUBLE PRECISION), CAST(:userLat AS DOUBLE PRECISION)),
          ST_MakePoint(CAST(post.longitude AS DOUBLE PRECISION), CAST(post.latitude AS DOUBLE PRECISION))
        ) <= :discoveryRadius`, { 
          userLat: locationInput.latitude, 
          userLng: locationInput.longitude,
          discoveryRadius 
        })
        .getMany();

      this.logger.log(`🎯 [BIDIRECTIONAL_DISCOVERY] 🔍 Query executed - found ${nearbyPosts.length} posts`);
      if (nearbyPosts.length > 0) {
        this.logger.log(`🎯 [BIDIRECTIONAL_DISCOVERY] 📍 Posts found: ${JSON.stringify(nearbyPosts.map(p => ({ id: p.id, type: p.type, latitude: p.latitude, longitude: p.longitude, range: p.range })))}`);
      }

      this.logger.log(`🎯 [BIDIRECTIONAL_DISCOVERY] 📍 Found ${nearbyPosts.length} nearby posts`);

      if (nearbyPosts.length === 0) {
        this.logger.log(`🎯 [BIDIRECTIONAL_DISCOVERY] ℹ️ No nearby posts found for user ${userId}`);
        return;
      }

      // Check each post to see if user is within the post's specific radius
      let invitesCreated = 0;
      for (const post of nearbyPosts) {
        try {
          // Calculate exact distance to post
          const distanceResult = await this.artistPostRepository
            .createQueryBuilder()
            .select(`ST_DistanceSphere(
              ST_MakePoint(CAST(:userLng AS DOUBLE PRECISION), CAST(:userLat AS DOUBLE PRECISION)),
              ST_MakePoint(CAST(:postLng AS DOUBLE PRECISION), CAST(:postLat AS DOUBLE PRECISION))
            )`, 'distance')
            .setParameters({
              userLat: locationInput.latitude,
              userLng: locationInput.longitude,
              postLat: post.latitude,
              postLng: post.longitude
            })
            .getRawOne();

          const distanceInMeters = parseFloat(distanceResult.distance);
          const postRange = post.range;

          this.logger.log(`🎯 [BIDIRECTIONAL_DISCOVERY] 🔍 Post ${post.id} by ${post.user?.full_name || 'Unknown'}: distance=${distanceInMeters.toFixed(2)}m, range=${postRange}m`);

          // Check if user is within the post's radius
          if (distanceInMeters <= postRange) {
            // Check if invite already exists
            const existingInvite = await this.artistPostUserService.getArtistPostByPostId(
              userId,
              post.id
            );

            if (existingInvite) {
              this.logger.log(`🎯 [BIDIRECTIONAL_DISCOVERY] ⚠️ Invite already exists for user ${userId} to post ${post.id} with status ${existingInvite.status}`);
              continue;
            }

            // Create invite for this post
            const inviteExpiry = new Date(currentTime.getTime() + 30 * 60 * 1000); // 30 minutes from now

            await this.artistPostUserService.createArtistPostUser({
              userId: userId,
              artistPostId: post.id,
              status: Invite_Status.PENDING,
              validTill: inviteExpiry,
            });

            this.logger.log(`🎯 [BIDIRECTIONAL_DISCOVERY] ✅ Created invite for user ${userId} to post ${post.id} by ${post.user?.full_name || 'Unknown'} (distance: ${distanceInMeters.toFixed(2)}m <= ${postRange}m)`);
            invitesCreated++;
          } else {
            this.logger.log(`🎯 [BIDIRECTIONAL_DISCOVERY] ⚠️ User ${userId} is ${distanceInMeters.toFixed(2)}m away from post ${post.id} (range: ${postRange}m) - too far`);
          }
        } catch (error) {
          this.logger.error(`🎯 [BIDIRECTIONAL_DISCOVERY] ❌ Error processing post ${post.id}: ${error?.message}`);
        }
      }

      this.logger.log(`🎯 [BIDIRECTIONAL_DISCOVERY] 🎉 Completed invite discovery for user ${userId}: ${invitesCreated} invites created from ${nearbyPosts.length} nearby posts`);

      return { invitesCreated, nearbyPostsFound: nearbyPosts.length };

    } catch (error) {
      this.logger.error(`🎯 [BIDIRECTIONAL_DISCOVERY] ❌ Error in invite discovery for user ${userId}: ${error?.message}`);
      // Don't throw error - location update should still succeed even if invite discovery fails
      return { invitesCreated: 0, nearbyPostsFound: 0 };
    }
  }
}
