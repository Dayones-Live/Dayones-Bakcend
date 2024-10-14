import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserSignatureInput } from '../dto/types';
import { Signatures } from '../entities/signature.entity';
import { SignatureMapper } from '../dto/signature.mapper';
import * as path from 'path';
import * as fs from 'fs';
const heicConvert = require('heic-convert');
import { rembg } from '@remove-background-ai/rembg.js';
import { S3Service } from '@app/modules/libs/modules/aws/s3/services/s3.service';
import { ERROR_MESSAGES } from '@app/shared/constants/constants';
import { extractS3KeyFromUrl } from '../utils';
var mime = require('mime-types');

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
  async createSignature(
    createUserSignatureInput: CreateUserSignatureInput,
    buffer: Buffer,
    originalname: string,
  ): Promise<Signatures> {
    try {
      // Use the upsert method
      const signatureDto = this.signatureMapper.dtoToEntity(
        createUserSignatureInput,
      );
      const signature = await this.signaturesRepository.save(signatureDto);
      const uploadUrl = await this.saveUserSignature(
        createUserSignatureInput.userId,
        buffer,
        originalname,
        signature?.id,
      );
      signature.url = uploadUrl;
      await this.signaturesRepository.save(signatureDto);
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
      const signatureDelete = await this.s3Service.deleteFile(key);
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
    const tempFilePath = path.join(tempDir, fileName); // Full path for the temp file

    // Ensure the temporary directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    // Save the image temporarily to /tmp folder on the server
    fs.writeFileSync(tempFilePath, fileBuffer);
    console.log(`File saved temporarily at: ${tempFilePath}`);

    let imagePath = tempFilePath;
    if (fileName.toLowerCase().endsWith('.heic')) {
      const convertedBuffer = await heicConvert({
        buffer: fileBuffer, // The HEIC file buffer
        format: 'PNG',
        quality: 1,
      });

      imagePath = path.join('/tmp', `${fileName.replace(/\.heic$/i, '.png')}`);
      fs.writeFileSync(imagePath, convertedBuffer);
      console.log(`File .heic -> png saved temporarily at: ${tempFilePath}`);
    }

    // Background removal using the rembg service
    const { outputImagePath, cleanup } = await rembg({
      apiKey:
        process.env.BG_REMOVE_API_KEY || 'e35642ac-0040-4bf7-8f50-ea5a3ddd0419', // Ensure API key is set in .env file
      inputImage: tempFilePath,
      onDownloadProgress: console.log,
      onUploadProgress: console.log,
      returnBase64: false,
    });

    console.log(
      `Background removal completed, processed image path: ${outputImagePath}`,
    );
    const processedImage = fs.readFileSync(outputImagePath || '');
    fs.writeFileSync(tempFilePath, processedImage);
    const s3Key = `${userId}/signatures/${signatureId}.png`; // Replace HEIC extension with PNG if necessary
    const fileMimeType = mime.lookup(fileName);
    const uploadUrl = await this.s3Service.uploadFile(
      tempFilePath,
      s3Key,
      fileMimeType,
    );
    // Cleanup: Delete the temporary directory and files
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log(`Temporary folder ${tempDir} deleted successfully.`);
    return uploadUrl;
  }
}
