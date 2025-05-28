const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
import { Meta, Paginate } from '@app/types';
import * as fs from 'fs';
import axios from 'axios';
import heicConvert from 'heic-convert';

// Initialize dayjs with UTC plugin
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
 * Removes background from an image using remove.bg API.
 * @param inputImagePath - Path of the image to process
 * @returns {Promise<string>} - Path to the processed image
 */
export async function removeImageBackground(
  inputImagePath: string,
): Promise<string> {
  try {
    console.log('Starting background removal process...');
    console.log('API Key present:', !!process.env.REMOVE_BG_API_KEY);
    console.log('Input image path:', inputImagePath);
    
    if (!process.env.REMOVE_BG_API_KEY) {
      console.error('REMOVE_BG_API_KEY is not set in environment variables');
      throw new Error('Background removal API key is not configured');
    }

    // Read the file as a buffer instead of using openAsBlob
    const fileBuffer = fs.readFileSync(inputImagePath);
    const formData = new FormData();
    
    // Required parameters
    formData.append("image_file", new Blob([fileBuffer], { type: 'image/png' }));
    
    // Optional parameters with recommended settings
    formData.append("size", "auto"); // Use highest available resolution
    formData.append("type", "auto"); // Auto-detect foreground type
    formData.append("format", "auto"); // Use PNG if transparent, JPG if not
    formData.append("channels", "rgba"); // Get the finalized image with alpha channel
    formData.append("semitransparency", "true"); // Enable semi-transparency for car windows

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { 
        "X-Api-Key": process.env.REMOVE_BG_API_KEY,
        "Accept": "image/png" // We'll always get PNG for transparency
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.errors?.[0]?.title || response.statusText;
      
      // Handle specific error cases
      switch (response.status) {
        case 400:
          throw new Error(`Invalid request: ${errorMessage}`);
        case 402:
          throw new Error('Insufficient credits for background removal');
        case 403:
          throw new Error('Authentication failed: Invalid API key');
        case 429:
          console.warn('Rate limit exceeded for background removal service. Using original image.');
          return inputImagePath;
        default:
          throw new Error(`Background removal failed: ${errorMessage}`);
      }
    }

    // Get response headers for logging
    const creditsCharged = response.headers.get('X-Credits-Charged');
    const imageType = response.headers.get('X-Type');
    console.log('Background removal completed:', {
      creditsCharged,
      imageType,
      width: response.headers.get('X-Width'),
      height: response.headers.get('X-Height')
    });

    const outputBuffer = Buffer.from(await response.arrayBuffer());
    const outputPath = inputImagePath.replace(/\.[^/.]+$/, '') + '-nobg.png';
    fs.writeFileSync(outputPath, outputBuffer);

    console.log('Output image saved to:', outputPath);
    return outputPath;
  } catch (error) {
    console.error('Background removal failed:', {
      error: error.message,
      stack: error.stack,
      code: error.code,
      status: error.status,
    });
    
    // If any error occurs, return the original image
    console.warn('Using original image due to error');
    return inputImagePath;
  }
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

/**
 * Downloads an image from a specified URL and saves it to a given file path.
 * @param url - The URL of the image to download
 * @param savePath - The local path where the image will be saved
 * @returns {Promise<string>} - A promise that resolves to the path of the saved image
 * @throws {Error} - Throws an error if the download fails or the URL is invalid
 */
export const downloadImageFromUrl = async (
  url: string,
  savePath: string,
): Promise<string> => {
  try {
    const response = await axios.get(url, {
      responseType: 'stream',
    });

    return new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(savePath);

      response.data.pipe(writer);

      writer.on('finish', () => resolve(savePath));
      writer.on('error', (err) => {
        fs.unlink(savePath, () => reject(err)); // Clean up partially downloaded file
      });
    });
  } catch (error) {
    throw new Error(`Failed to download image from ${url}: ${error.message}`);
  }
};
