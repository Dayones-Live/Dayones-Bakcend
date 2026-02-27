import { Injectable, Logger, HttpException, HttpStatus, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MerchDrop } from './entities/merch-drop.entity';
import { MerchProduct } from './entities/merch-product.entity';
import { MerchDropStatus } from './constants';
import { StripeService } from '../stripe/stripe.service';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@app/shared/constants/constants';

@Injectable()
export class MerchService {
  private readonly logger = new Logger(MerchService.name);

  constructor(
    @InjectRepository(MerchDrop)
    private merchDropRepo: Repository<MerchDrop>,
    @InjectRepository(MerchProduct)
    private merchProductRepo: Repository<MerchProduct>,
    @Inject(forwardRef(() => StripeService))
    private stripeService: StripeService,
    @InjectQueue('merch-creation')
    private merchCreationQueue: Queue,
  ) {}

  async createMerchDrop(artistPostId: string, artistId: string): Promise<MerchDrop> {
    try {
      const existing = await this.merchDropRepo.findOne({ where: { artist_post_id: artistPostId } });
      if (existing) {
        throw new HttpException(ERROR_MESSAGES.MERCH_DROP_EXISTS, HttpStatus.BAD_REQUEST);
      }

      const stripeAccount = await this.stripeService.getStripeAccountByUserId(artistId);
      if (!stripeAccount || !stripeAccount.onboarding_complete) {
        throw new HttpException(ERROR_MESSAGES.STRIPE_ONBOARDING_INCOMPLETE, HttpStatus.BAD_REQUEST);
      }

      const dropDurationHours = parseInt(process.env.MERCH_DROP_DURATION_HOURS || '48');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + dropDurationHours);

      const merchDrop = new MerchDrop();
      merchDrop.artist_post_id = artistPostId;
      merchDrop.artist_id = artistId;
      merchDrop.status = MerchDropStatus.CREATING;
      merchDrop.expires_at = expiresAt;

      const savedDrop = await this.merchDropRepo.save(merchDrop);

      await this.merchCreationQueue.add('create-products', {
        merchDropId: savedDrop.id,
        artistId,
        artistPostId,
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      });

      return savedDrop;
    } catch (error) {
      this.logger.error(`Create merch drop failed: ${error.message}`);
      if (error instanceof HttpException) throw error;
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getMerchDrop(id: string): Promise<MerchDrop> {
    try {
      const drop = await this.merchDropRepo.findOne({
        where: { id },
        relations: ['products', 'artistPost'],
      });
      if (!drop) {
        throw new HttpException(ERROR_MESSAGES.MERCH_DROP_NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      return drop;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getMerchDropByPostId(postId: string): Promise<MerchDrop> {
    try {
      const drop = await this.merchDropRepo.findOne({
        where: { artist_post_id: postId },
        relations: ['products'],
      });
      if (!drop) {
        throw new HttpException(ERROR_MESSAGES.MERCH_DROP_NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      return drop;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async cancelMerchDrop(id: string, artistId: string): Promise<void> {
    try {
      const drop = await this.merchDropRepo.findOne({ where: { id, artist_id: artistId } });
      if (!drop) {
        throw new HttpException(ERROR_MESSAGES.MERCH_DROP_NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      drop.status = MerchDropStatus.CANCELLED;
      await this.merchDropRepo.save(drop);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async activateMerchDrop(merchDropId: string): Promise<void> {
    await this.merchDropRepo.update(merchDropId, { status: MerchDropStatus.ACTIVE });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expireDrops(): Promise<void> {
    try {
      const now = new Date();
      const result = await this.merchDropRepo.update(
        { status: MerchDropStatus.ACTIVE, expires_at: LessThan(now) },
        { status: MerchDropStatus.EXPIRED },
      );
      if (result.affected > 0) {
        this.logger.log(`Expired ${result.affected} merch drops`);
      }
    } catch (error) {
      this.logger.error(`Expire drops cron failed: ${error.message}`);
    }
  }
}
