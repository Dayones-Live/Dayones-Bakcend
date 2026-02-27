import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { MerchProduct } from '../entities/merch-product.entity';
import { ProductType } from '../constants';
import { MerchService } from '../merch.service';
import { PrintfulService } from '../../printful/printful.service';
import { ArtistPost } from '@artist-post/entities/artist-post.entity';

@Processor('merch-creation', { concurrency: 2 })
export class MerchCreationProcessor extends WorkerHost {
  private readonly logger = new Logger(MerchCreationProcessor.name);

  private readonly defaultPrices: Record<string, number> = {
    [ProductType.TSHIRT]: 45,
    [ProductType.HOODIE]: 75,
    [ProductType.TANK]: 30,
    [ProductType.POSTER]: 50,
    [ProductType.HAT]: 35,
  };

  private readonly activeProductTypes: ProductType[] = [
    ProductType.TSHIRT,
    ProductType.HOODIE,
    ProductType.TANK,
    ProductType.POSTER,
  ];

  constructor(
    @InjectRepository(MerchProduct)
    private merchProductRepo: Repository<MerchProduct>,
    @InjectRepository(ArtistPost)
    private artistPostRepo: Repository<ArtistPost>,
    private merchService: MerchService,
    private printfulService: PrintfulService,
  ) {
    super();
  }

  async process(job: Job<{ merchDropId: string; artistId: string; artistPostId: string }>): Promise<void> {
    const { merchDropId, artistId, artistPostId } = job.data;
    this.logger.log(`Processing merch creation for drop ${merchDropId}`);

    try {
      const artistPost = await this.artistPostRepo.findOne({ where: { id: artistPostId } });
      const imageUrl = artistPost?.image_url || '';

      for (const productType of this.activeProductTypes) {
        try {
          const product = new MerchProduct();
          product.merch_drop_id = merchDropId;
          product.product_type = productType;
          product.retail_price = this.defaultPrices[productType];
          product.image_url = imageUrl;

          await this.merchProductRepo.save(product);
          this.logger.log(`Created ${productType} product for drop ${merchDropId}`);
        } catch (error) {
          this.logger.error(`Failed to create ${productType} for drop ${merchDropId}: ${error.message}`);
        }
      }

      await this.merchService.activateMerchDrop(merchDropId);
      this.logger.log(`Merch drop ${merchDropId} activated with ${this.activeProductTypes.length} products`);
    } catch (error) {
      this.logger.error(`Merch creation job failed: ${error.message}`);
      throw error;
    }
  }
}
