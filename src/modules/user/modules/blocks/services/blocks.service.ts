import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Blocks } from '../entities/blocks.entity';
import { AllBlockedUserResponse, BlockUserInput } from '../dto/types';
import { BlocksMapper } from '../dto/blocks.mapper';
import { UserService } from '@app/modules/user/services/user.service';
import { ERROR_MESSAGES } from '@app/shared/constants/constants';
import { Paginate, PaginationDto } from '@app/types';
import { getPaginated, getPaginatedOutput } from '@app/shared/utils';

@Injectable()
export class BlocksService {
  constructor(
    @InjectRepository(Blocks)
    private blockRepository: Repository<Blocks>,
    private userService: UserService,
    private blockMapper: BlocksMapper,
  ) {}

  /**
   * Service to block a user
   * @param blockUserInput
   * @returns {Block}
   */
  async blockUser(blockUserInput: BlockUserInput): Promise<Blocks> {
    try {
      const { blockedUser, blockedBy } = blockUserInput;

      // Validate that the blocked user is not the same as the logged-in user
      if (blockedUser === blockedBy) {
        throw new HttpException(
          ERROR_MESSAGES.CANNOT_BLOCK_YOURSELF,
          HttpStatus.BAD_REQUEST,
        );
      }
      // Check if the blocked user exists in the user database
      await this.userService.findUserById(blockedUser);
      // Check if the user is already blocked
      const existingBlock = await this.blockRepository.findOne({
        where: {
          blocked_by: blockedBy,
          blocked_user: blockedUser,
        },
      });

      if (existingBlock) {
        throw new HttpException(
          ERROR_MESSAGES.USER_ALREADY_BLOCKED,
          HttpStatus.BAD_REQUEST,
        );
      }
      const blockUserDto = this.blockMapper.dtoToEntity(blockUserInput);
      const response = await this.blockRepository.save(blockUserDto);
      return response;
    } catch (error) {
      console.error(
        '🚀 ~ file:blocks.service.ts:96  ~ BlockService ~ error:',
        error,
      );
      throw new HttpException(` ${error?.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Service to unblock a user
   * @param unblockUserInput
   * @returns {Boolean}
   */
  async unblockUser(unblockUserInput: BlockUserInput): Promise<Boolean> {
    try {
      // Assuming unblockUserInput has identifiers to find the record
      const { blockedBy, blockedUser } = unblockUserInput;
      // Check if the entry exists
      const blockEntry = await this.blockRepository.findOne({
        where: { blocked_by: blockedBy, blocked_user: blockedUser },
      });

      if (!blockEntry) {
        throw new HttpException(
          ERROR_MESSAGES.USER_NOT_BLOCK,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Delete the block entry
      await this.blockRepository.remove(blockEntry);

      return true;
    } catch (error) {
      console.error(
        '🚀 ~ file: blocks.service.ts ~ BlockService ~ error:',
        error,
      );
      throw new HttpException(` ${error?.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Service to fetch all users b blocked by current user
   * @param userId
   * @param req
   * @returns {AllBlockedUserResponse}
   */
  async fetchAllBlockedUsers(
    userId: string,
    req: PaginationDto,
  ): Promise<AllBlockedUserResponse> {
    try {
      const paginate: Paginate = getPaginated(
        req.pageNo || 1,
        req.pageSize || 0,
      );
      const [blockedUsers, count] = await this.blockRepository.findAndCount({
        relations: ['blockedUser'], // Include the blocked user relation
        select: {
          blockedUser: {
            id: true,
            full_name: true,
            email: true,
            phone_number: true,
            latitude: true,
            longitude: true,
            avatar_url: true,
          },
        },
        where: {
          blocked_by: userId, // Assuming "blockedBy" is the column for user_id in the blocks table
        },
        skip: paginate.offset, // For pagination
        take: paginate.limit, // For pagination
      });

      const meta = getPaginatedOutput(
        paginate.pageNo,
        paginate.pageSize,
        count,
      );

      return { blocked_users: blockedUsers, meta };
    } catch (error) {
      console.error(
        '🚀 ~ file:blocks.service.ts:96 ~ fetchAllBlockedUsers ~ error:',
        error,
      );
      throw error;
    }
  }

  /**
   * Service to check if either user has blocked the other.
   * @param currentUserId - The ID of the first user (requesting user).
   * @param targetUserId - The ID of the second user (target user).
   * @returns {boolean} - True if either user has blocked the other, false otherwise.
   */
  async checkBlockStatus(
    currentUserId: string,
    targetUserId: string,
  ): Promise<boolean> {
    try {
      // Query for a block record where currentUser blocked targetUser or vice versa
      const blockRecord = await this.blockRepository.findOne({
        where: [
          { blocked_by: currentUserId, blocked_user: targetUserId },
          { blocked_by: targetUserId, blocked_user: currentUserId },
        ],
      });

      return !!blockRecord;
    } catch (error) {
      console.error('🚀 ~ checkBlockStatus ~ error:', error);
      throw error;
    }
  }
}
