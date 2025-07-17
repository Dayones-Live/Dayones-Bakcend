import {
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from '../entities/profile.entity';
import { ProfileGallery } from '../entities/profile-gallery.entity';
import { User } from '../entities/user.entity';
import {
  ProfileUpdateInput,
  GalleryImageInput,
  GalleryImageUpdateInput,
  GetUserProfileInput,
} from '../dto/profile.types';
import { GlobalServiceResponse } from '@app/shared/types/types';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@app/shared/constants/constants';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    @InjectRepository(ProfileGallery)
    private profileGalleryRepository: Repository<ProfileGallery>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Get or create user profile
   */
  async getOrCreateProfile(userId: string): Promise<Profile> {
    try {
      let profile = await this.profileRepository.findOne({
        where: { user_id: userId },
      });

      if (!profile) {
        profile = this.profileRepository.create({
          user_id: userId,
        });
        await this.profileRepository.save(profile);
      }

      return profile;
    } catch (error) {
      console.error('🚀 ~ ProfileService ~ getOrCreateProfile ~ error:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    profileUpdateInput: ProfileUpdateInput,
  ): Promise<GlobalServiceResponse> {
    try {
      const profile = await this.getOrCreateProfile(userId);

      // Update profile fields
      Object.assign(profile, profileUpdateInput);
      await this.profileRepository.save(profile);

      return {
        statusCode: HttpStatus.OK,
        message: SUCCESS_MESSAGES.PROFILE_UPDATED_SUCCESS,
        data: profile,
      };
    } catch (error) {
      console.error('🚀 ~ ProfileService ~ updateProfile ~ error:', error);
      throw error;
    }
  }

  /**
   * Get user profile with gallery
   */
  async getUserProfile(input: GetUserProfileInput): Promise<GlobalServiceResponse> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: input.userId, is_deleted: false },
        relations: ['profile', 'profileGallery'],
      });

      if (!user) {
        throw new HttpException(
          ERROR_MESSAGES.USER_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }

      // Get or create profile if it doesn't exist
      const profile = await this.getOrCreateProfile(input.userId);

      // Get active gallery images
      const galleryImages = await this.profileGalleryRepository.find({
        where: { user_id: input.userId, is_active: true },
        order: { display_order: 'ASC', created_at: 'DESC' },
      });

      return {
        statusCode: HttpStatus.OK,
        message: SUCCESS_MESSAGES.PROFILE_FETCHED_SUCCESS,
        data: {
          user: {
            id: user.id,
            full_name: user.full_name,
            avatar_url: user.avatar_url,
            role: user.role,
            created_at: user.created_at,
          },
          profile,
          gallery: galleryImages,
        },
      };
    } catch (error) {
      console.error('🚀 ~ ProfileService ~ getUserProfile ~ error:', error);
      throw error;
    }
  }

  /**
   * Add image to user gallery
   */
  async addGalleryImage(
    userId: string,
    galleryImageInput: GalleryImageInput,
  ): Promise<GlobalServiceResponse> {
    try {
      const galleryImage = this.profileGalleryRepository.create({
        ...galleryImageInput,
        user_id: userId,
      });

      await this.profileGalleryRepository.save(galleryImage);

      return {
        statusCode: HttpStatus.OK,
        message: SUCCESS_MESSAGES.GALLERY_IMAGE_ADDED_SUCCESS,
        data: galleryImage,
      };
    } catch (error) {
      console.error('🚀 ~ ProfileService ~ addGalleryImage ~ error:', error);
      throw error;
    }
  }

  /**
   * Update gallery image
   */
  async updateGalleryImage(
    userId: string,
    imageId: string,
    galleryImageUpdateInput: GalleryImageUpdateInput,
  ): Promise<GlobalServiceResponse> {
    try {
      const galleryImage = await this.profileGalleryRepository.findOne({
        where: { id: imageId, user_id: userId },
      });

      if (!galleryImage) {
        throw new HttpException(
          ERROR_MESSAGES.GALLERY_IMAGE_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }

      Object.assign(galleryImage, galleryImageUpdateInput);
      await this.profileGalleryRepository.save(galleryImage);

      return {
        statusCode: HttpStatus.OK,
        message: SUCCESS_MESSAGES.GALLERY_IMAGE_UPDATED_SUCCESS,
        data: galleryImage,
      };
    } catch (error) {
      console.error('🚀 ~ ProfileService ~ updateGalleryImage ~ error:', error);
      throw error;
    }
  }

  /**
   * Delete gallery image
   */
  async deleteGalleryImage(
    userId: string,
    imageId: string,
  ): Promise<GlobalServiceResponse> {
    try {
      const galleryImage = await this.profileGalleryRepository.findOne({
        where: { id: imageId, user_id: userId },
      });

      if (!galleryImage) {
        throw new HttpException(
          ERROR_MESSAGES.GALLERY_IMAGE_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }

      await this.profileGalleryRepository.remove(galleryImage);

      return {
        statusCode: HttpStatus.OK,
        message: SUCCESS_MESSAGES.GALLERY_IMAGE_DELETED_SUCCESS,
        data: null,
      };
    } catch (error) {
      console.error('🚀 ~ ProfileService ~ deleteGalleryImage ~ error:', error);
      throw error;
    }
  }

  /**
   * Get user gallery
   */
  async getUserGallery(userId: string): Promise<GlobalServiceResponse> {
    try {
      const galleryImages = await this.profileGalleryRepository.find({
        where: { user_id: userId, is_active: true },
        order: { display_order: 'ASC', created_at: 'DESC' },
      });

      return {
        statusCode: HttpStatus.OK,
        message: SUCCESS_MESSAGES.GALLERY_FETCHED_SUCCESS,
        data: galleryImages,
      };
    } catch (error) {
      console.error('🚀 ~ ProfileService ~ getUserGallery ~ error:', error);
      throw error;
    }
  }
} 