import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { User } from '../entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserInput } from 'src/modules/lib/Aws/cognito/dto/types';
import { UserUpdateInput } from '../dto/types';
import { GlobalServiceResponse } from 'src/shared/types';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
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
      // Ensure the role is an array, as per the entity definition
      const newUser = await this.userRepository.save({
        ...createUserInput,
        full_name: createUserInput.name,
        role: [createUserInput.role], // Wrap the role in an array
      });

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
        throw new HttpException('No Users found', HttpStatus.NOT_FOUND);
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
          `User with user_sub : ${id} not found`,
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
        throw new HttpException(`User not found`, HttpStatus.NOT_FOUND);
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
   *
   * @param user_sub
   * @param is_confirmed
   * @returns {User}
   */
  async updateIsConfirmedUser({
    user_sub,
    is_confirmed,
  }: {
    user_sub: string;
    is_confirmed: boolean;
  }): Promise<GlobalServiceResponse> {
    try {
      const existingUser = await this.userRepository.findOneBy({
        user_sub,
      });

      if (!existingUser) {
        throw new HttpException(
          `User with User Sub: ${user_sub} does not exist`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Update the user's is_confirmed field
      existingUser.is_confirmed = is_confirmed;

      // Save the updated user object
      const updatedUser = await this.userRepository.save(existingUser);
      return {
        statusCode: 200,
        message: 'User Update Successful',
        data: { ...updatedUser, role: updatedUser.role[0] },
      };
    } catch (error) {
      console.error(
        '🚀 ~ file: user.service.ts ~ UserService ~ updateUser ~ error:',
        error,
      );
      throw error;
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
   * Service tp update the user
   * @param userUpdateInput
   * @returns
   */
  async updateUser(
    userUpdateInput: UserUpdateInput,
  ): Promise<GlobalServiceResponse> {
    try {
      // Check if the user already exists
      const existingUser = await this.userRepository.findOne({
        where: { id: userUpdateInput.id }, // Check based on the user's id
      });

      if (!existingUser) {
        throw new HttpException(
          `User with ID: ${userUpdateInput.id} does not exist`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Update existing user
      const updatedUser = await this.userRepository.save({
        ...existingUser, // Retain existing properties
        ...userUpdateInput, // Overwrite with new values from body
        full_name: userUpdateInput.name || existingUser.full_name,
        role: userUpdateInput?.role
          ? [userUpdateInput.role]
          : [existingUser.role[0]], // Ensure role is an array
      });

      return {
        statusCode: 200,
        message: 'User Update Successful',
        data: { ...updatedUser, role: updatedUser.role[0] },
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
}
