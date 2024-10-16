import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand, S3 } from '@aws-sdk/client-s3';
import { createFileReadStream } from '@app/shared/utils';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private s3Client: S3;
  private bucketName = process.env.AWS_S3_BUCKET_NAME;

  constructor() {
    this.s3Client = new S3({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  /**
   * Uploads a file to S3
   * @param filePath - Path to the file
   * @param key - S3 object key (filename in S3)
   * @returns {Promise<string>} - S3 file URL
   */
  async uploadFile(
    filePath: string,
    key: string,
    fileMimeType: string | boolean,
  ): Promise<string> {
    try {
      const fileStream = createFileReadStream(filePath);
      const uploadParams = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
        Body: fileStream,
        ContentType: (fileMimeType as string) || 'application/octet-stream',
      };

      await this.s3Client.putObject(uploadParams);
      return `https://${this.bucketName}.s3.amazonaws.com/${key}`;
    } catch (error) {
      console.error('S3Service ~ uploadFile error:', error);
      throw new HttpException(
        `File Upload Failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Deletes a file from S3
   * @param key - S3 object key (filename in S3)
   * @returns {Promise<void>}
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const deleteParams = {
        Bucket: this.bucketName,
        Key: key,
      };

      await this.s3Client.deleteObject(deleteParams);
    } catch (error) {
      console.error('S3Service ~ deleteFile error:', error);
      throw new HttpException(
        `File Deletion Failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Generate a signed URL for uploading a file
   * @param key - S3 object key (filename in S3)
   * @param fileMimeType - File MIME type
   * @returns {Promise<string>} - Signed URL
   */
  async getSignedUrl(
    key: string,
    fileMimeType: string,
    isUpload: boolean,
  ): Promise<string> {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: key,
        ContentType: fileMimeType || 'application/octet-stream',
      };

      // Create a command to sign the URL
      const command = isUpload
        ? new PutObjectCommand(params)
        : new GetObjectCommand(params);

      // Generate a signed URL valid for 15 minutes
      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 900, // URL is valid for 15 minutes
      });

      return signedUrl;
    } catch (error) {
      console.error('S3Service ~ getSignedUrl error:', error);
      throw new HttpException(
        `Failed to generate signed URL: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
