import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { User } from '../entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ROLES } from 'src/shared/constants';
import { createUserInput } from 'src/modules/lib/Aws/cognito/dto/types';

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
  async createUser(body: createUserInput): Promise<User> {
    try {
      const existingUser = await this.userRepository.findOne({
        where: { email: body?.email },
      });

      if (existingUser) {
        throw new HttpException(
          `User with Email: ${body.email} already exists`,
          HttpStatus.BAD_REQUEST,
        );
      }
      // Ensure the role is an array, as per the entity definition
      const newUser = await this.userRepository.save({
        ...body,
        full_name: body.name,
        role: [body.role], // Wrap the role in an array
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

  async updateIsConfirmedUser({
    user_sub,
    is_confirmed,
  }: {
    user_sub: string;
    is_confirmed: boolean;
  }): Promise<User> {
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
      return await this.userRepository.save(existingUser);
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
          HttpStatus.BAD_REQUEST,
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
}
