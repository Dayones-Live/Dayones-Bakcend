import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserSignatureInput } from '../dto/types';
import { Signatures } from '../entities/signature.entity';

@Injectable()
export class SignatureService {
  constructor(
    @InjectRepository(Signatures)
    private signaturesRepository: Repository<Signatures>,
  ) {}

  /**
   * Service to create user signature
   * @param createUserSignatureInput
   * @returns {Signatures}
   */
  async createSignatureNotification(
    createUserSignatureInput: CreateUserSignatureInput,
  ): Promise<Signatures> {
    try {
      // Use the upsert method
      const signature = await this.signaturesRepository.save(
        createUserSignatureInput,
      );
      return signature;
    } catch (error) {
      console.error(
        '🚀 ~ file:signature.service.ts:96 ~ NotificationService ~ upsertSignatureNotification ~ error:',
        error,
      );
      throw new HttpException(` ${error?.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Service to delete the signature
   * @param id
   * @param user_id
   * @returns {boolean}
   */
  async deleteSignatureById(id: string, user_id: string): Promise<boolean> {
    try {
      // Delete the signature based on both id and user_id
      const deleteResult = await this.signaturesRepository.delete({
        id: id,
        user_id: user_id,
      });

      // Check if any rows were affected (i.e., deleted)
      if (deleteResult.affected === 0) {
        throw new HttpException(
          `Signature not found or already deleted`,
          HttpStatus.NOT_FOUND,
        );
      }

      return true;
    } catch (err) {
      console.error(
        '🚀 ~ file:signature.service.ts:96 ~ deleteSignatureById  ~ error:',
        err,
      );
      throw err;
    }
  }

  /**
   * Service to fetch all logged in user signatures
   * @param user_id
   * @returns {Signatures[]}
   */
  async fetchAllSignatures(user_id: string): Promise<Signatures[]> {
    try {
      const signatures: Signatures[] = await this.signaturesRepository.find({
        where: {
          user_id,
        },
      });
      return signatures;
    } catch (error) {
      console.error(
        '🚀 ~ file:signature.service.ts:96 ~ fetchAllSignatures ~ error:',
        error,
      );
      throw error;
    }
  }
}
