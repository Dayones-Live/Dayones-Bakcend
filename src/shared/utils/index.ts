import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { Meta, Paginate } from '@app/types';
import * as fs from 'fs';
import * as path from 'path';
import heicConvert from 'heic-convert';
import { rembg } from '@remove-background-ai/rembg.js';

dayjs.extend(utc);

/**
 * Maps Entity to Dto
 *
 * @param entity
 * @param input
 * @param update
 */
export const mapInputToEntity = <T>(
  entity: T,
  input: Record<string, any>,
  update: boolean,
  changeCase: boolean = true,
): T => {
  Object.entries(input).forEach(([key, value]) => {
    let keyValue = key;

    if (changeCase) {
      keyValue = key
        .split(/(?=[A-Z])/)
        .join('_')
        .toLowerCase();
    }

    if (update) {
      (entity as Record<string, any>)[keyValue] =
        value !== undefined ? value : (entity as Record<string, any>)[keyValue];
    } else {
      (entity as Record<string, any>)[keyValue] = value;
    }
  });
  return entity;
};

export const getPaginated = (pageNo: number, pageSize: number): Paginate => {
  return {
    offset: (pageNo - 1) * pageSize,
    limit: pageSize,
    pageSize: pageSize,
    pageNo: pageNo,
  };
};

export const getPaginatedOutput = (
  page: number,
  pageSize: number,
  count: number,
): Meta => {
  return {
    count,
    page: page ? Number(page) : 1,
    size: pageSize ? Number(pageSize) : count,
    pages: pageSize ? Math.ceil(count / pageSize) : 1,
  };
};

export const getCurrentUtcTime = () => dayjs.utc().toDate();

/**
 * Ensures the directory exists. If it doesn't, creates it.
 * @param dirPath - Path of the directory
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath);
  }
}

/**
 * Saves a file to a specified path.
 * @param filePath - Full path where the file should be saved
 * @param fileBuffer - Buffer of the file to save
 */
export function saveFile(filePath: string, fileBuffer: Buffer): void {
  fs.writeFileSync(filePath, fileBuffer);
}

/**
 * Converts HEIC image to PNG format.
 * @param fileBuffer - Buffer of the HEIC image
 * @param fileName - Original filename
 * @returns {Promise<{ imagePath: string, buffer: Buffer }>}
 */
export async function convertHeicToPng(
  fileBuffer: Buffer,
  fileName: string,
): Promise<Buffer> {
  const convertedBuffer = await heicConvert({
    buffer: fileBuffer,
    format: 'PNG',
    quality: 1,
  });
  const pngBuffer = Buffer.from(convertedBuffer);
  return pngBuffer;
}

/**
 * Removes background from an image.
 * @param inputImagePath - Path of the image to process
 * @returns {Promise<string>} - Path to the processed image
 */
export async function removeImageBackground(
  inputImagePath: string,
): Promise<string> {
  const { outputImagePath } = await rembg({
    apiKey: process.env.BG_REMOVE_API_KEY || '',
    inputImage: inputImagePath,
    onDownloadProgress: console.log,
    onUploadProgress: console.log,
    returnBase64: false,
  });
  return outputImagePath || inputImagePath;
}

/**
 * Reads the image from a given path.
 * @param imagePath - Path of the image to read
 * @returns {Buffer} - Image buffer
 */
export function readImage(imagePath: string): Buffer {
  return fs.readFileSync(imagePath);
}

/**
 * Deletes a directory recursively and forcefully.
 * @param dirPath - The path to the directory to delete
 */
export function removeDirectory(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Creates a readable stream from a file.
 * @param filePath - The path to the file
 * @returns {fs.ReadStream} - The file stream
 */
export function createFileReadStream(filePath: string): fs.ReadStream {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File ${filePath} does not exist.`);
  }
  return fs.createReadStream(filePath);
}
