import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserSignatureInput } from '../dto/types';
import { Signatures } from '../entities/signature.entity';
import { SignatureMapper } from '../dto/signature.mapper';
import * as path from 'path';
import { S3Service } from '@app/modules/libs/modules/aws/s3/services/s3.service';
import { ERROR_MESSAGES } from '@app/shared/constants/constants';
import { extractS3KeyFromUrl } from '../utils';
import {
  convertHeicToPng,
  downloadImageFromUrl,
  ensureDirectoryExists,
  readImage,
  removeDirectory,
  removeImageBackground,
  saveFile,
} from '@app/shared/utils';
import mime from 'mime-types';

@Injectable()
export class SignatureService {
  constructor(
    @InjectRepository(Signatures)
    private signaturesRepository: Repository<Signatures>,
    private signatureMapper: SignatureMapper,
    private s3Service: S3Service,
  ) {}

  /**
   * Service to create user signature
   * @param createUserSignatureInput
   * @returns {Signatures}
   */
  async createSignature(userId: string, url: string): Promise<Signatures> {
    try {
      const response = await this.signaturesRepository.save({
        user_id: userId,
        url,
      });
      return response;
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
      const signature = await this.signaturesRepository.findOne({
        where: {
          id,
          user_id,
        },
      });
      if (!signature) {
        throw new HttpException(
          ERROR_MESSAGES.SIGNATURE_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      const deleteResult = await this.signaturesRepository.delete({
        id: id,
        user_id: user_id,
      });
      const key = extractS3KeyFromUrl(signature?.url);
      await this.s3Service.deleteFile(key);
      //Check if any rows were affected (i.e., deleted)
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

  async saveUserSignature(
    userId: string,
    fileBuffer: Buffer,
    fileName: string,
    signatureId: string,
  ) {
    const tempDir = path.join(__dirname, '..', 'temp'); // Create temp directory path
    const tempFilePath = path.join(
      tempDir,
      fileName.replace(/\.heic$/i, '.png'),
    ); // Full path for the temp file

    try {
      ensureDirectoryExists(tempDir);
      saveFile(tempFilePath, fileBuffer);

      let imagePath = tempFilePath;
      // If the file is in HEIC format, convert it to PNG
      if (fileName.toLowerCase().endsWith('.heic')) {
        const buffer = await convertHeicToPng(fileBuffer, fileName);
        fileBuffer = buffer; // Replace the file buffer with the converted PNG buffer
        saveFile(tempFilePath, fileBuffer);
      }

      let processedImagePath;
      try {
        processedImagePath = await removeImageBackground(imagePath);
        saveFile(tempFilePath, readImage(processedImagePath || ''));
      } catch (bgError) {
        console.error('Background removal failed, using original image:', bgError);
        // If background removal fails, use the original image
        processedImagePath = imagePath;
      }

      const s3Key = `${userId}/signatures/${signatureId}`; // Replace HEIC extension with PNG if necessary
      const fileMimeType = mime.lookup(fileName.replace(/\.heic$/i, '.png'));
      const uploadUrl = await this.s3Service.uploadFile(
        tempFilePath,
        s3Key,
        fileMimeType,
      );
      return uploadUrl;
    } catch (error) {
      console.error('Error in saveUserSignature:', error);
      throw new HttpException(
        `Failed to save signature: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    } finally {
      // Always clean up the temp directory
      removeDirectory(tempDir);
    }
  }

  /**
   * Service to to remove background from image when successfully uploaded
   * from front-end using presignedUrl
   * @param signatureId
   * @returns {imageUrl} image url without background
   */
  async removeBackgroundFromImage(signatureId: string, userId: string) {
    let tempDir = '';
    try {
      const getUploadImage = await this.signaturesRepository.findOne({
        where: { id: signatureId, user_id: userId },
      });

      if (getUploadImage) {
        tempDir = path.join(__dirname, '..', 'temp'); // Create temp directory path
        const parsedUrl = new URL(getUploadImage.url);

        // Use path.basename to get just the filename
        const fileName = path.basename(parsedUrl.pathname);
        const tempFilePath = path.join(
          tempDir,
          fileName.replace(/\.heic$/i, '.png'),
        ); // Full path for the temp file

        ensureDirectoryExists(tempDir);
        const imageUrl = getUploadImage?.url;

        // Step 1: Download the image and save locally
        const localImagePath = await downloadImageFromUrl(
          imageUrl,
          tempFilePath,
        );

        // Step 2: Remove the background
        const removedBackgroundImage =
          await removeImageBackground(localImagePath);

        // Step 3: Upload again to s3
        const s3Key = `${userId}/signatures/${signatureId}.png`; // Replace HEIC extension with PNG if necessary
        const fileMimeType = mime.lookup(fileName.replace(/\.heic$/i, '.png'));
        const uploadUrl = await this.s3Service.uploadFile(
          removedBackgroundImage,
          s3Key,
          fileMimeType,
        );

        //  update image with the latest one (without background)
        await this.signaturesRepository.update(signatureId, {
          url: uploadUrl,
        });
        removeDirectory(tempDir);
        return uploadUrl;
      }
    } catch (error) {
      console.error(
        '🚀 ~ SignatureService ~ removeBackgroundFromImage ~ error:',
        error,
      );
      removeDirectory(tempDir);
      throw error;
    }
  }
}
