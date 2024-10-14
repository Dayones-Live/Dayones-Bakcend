import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { S3 } from '@aws-sdk/client-s3';
import { createFileReadStream } from '@app/shared/utils';

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
    fileMimeType: string,
  ): Promise<string> {
    try {
      const fileStream = createFileReadStream(filePath);
      const uploadParams = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
        Body: fileStream,
        ContentType: fileMimeType || 'application/octet-stream',
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
}
