import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Job } from 'bullmq';
import { MerchProduct } from '../entities/merch-product.entity';
import { MerchService } from '../merch.service';
import { PrintfulService } from '../../printful/printful.service';
import { PrintfulCatalogService } from '../../printful/printful-catalog.service';
import { ImageNormalizationService } from '../services/image-normalization.service';
import { ArtistPost } from '@artist-post/entities/artist-post.entity';
import { PRODUCT_CATALOG, getAllVariants } from '../constants/product-catalog';
import { PushNotificationService } from '@app/shared/services/push-notification.service';
import { UserDeviceService } from '@app/modules/user/services/user-device.service';
import { ArtistPostUser } from '@app/modules/posts/modules/artist-post-user/entities/artist-post-user.entity';
import { Invite_Status } from '@app/modules/posts/modules/artist-post-user/constants/constants';

@Processor('merch-creation', { concurrency: 2 })
export class MerchCreationProcessor extends WorkerHost {
  private readonly logger = new Logger(MerchCreationProcessor.name);

  constructor(
    @InjectRepository(MerchProduct)
    private merchProductRepo: Repository<MerchProduct>,
    @InjectRepository(ArtistPost)
    private artistPostRepo: Repository<ArtistPost>,
    @InjectRepository(ArtistPostUser)
    private artistPostUserRepo: Repository<ArtistPostUser>,
    private merchService: MerchService,
    private printfulService: PrintfulService,
    private printfulCatalogService: PrintfulCatalogService,
    private imageNormalizationService: ImageNormalizationService,
    private pushNotificationService: PushNotificationService,
    private userDeviceService: UserDeviceService,
  ) {
    super();
  }

  async process(
    job: Job<
      | { merchDropId: string; artistId: string; artistPostId: string }
      | { kind: 'start-merch-drop'; artistId: string; artistPostId: string; merchDurationMinutes?: number }
    >,
  ): Promise<void> {
    // Two job shapes share this processor:
    //  1. start-merch-drop: scheduled with a delay when the artist enables
    //     Automated Merch Drop on a photo drop. Calls createMerchDrop which
    //     in turn enqueues the regular create-products job.
    //  2. create-products: the actual Printful + push pipeline.
    if ((job.data as any).kind === 'start-merch-drop') {
      const d = job.data as { kind: 'start-merch-drop'; artistId: string; artistPostId: string; merchDurationMinutes?: number };
      this.logger.log(`Auto-triggering merch drop for post ${d.artistPostId} (artist ${d.artistId})`);
      try {
        await this.merchService.createMerchDrop(d.artistPostId, d.artistId, d.merchDurationMinutes);
        this.logger.log(`Auto-trigger queued create-products for post ${d.artistPostId}`);
      } catch (err: any) {
        this.logger.error(`Auto-trigger failed for post ${d.artistPostId}: ${err?.message}`);
      }
      return;
    }
    const { merchDropId, artistId, artistPostId } = job.data as { merchDropId: string; artistId: string; artistPostId: string };
    this.logger.log(`Processing merch creation for drop ${merchDropId}`);

    try {
      const artistPost = await this.artistPostRepo.findOne({ where: { id: artistPostId } });
      const sourceImageUrl = artistPost?.image_url || '';
      let createdCount = 0;

      for (const sku of PRODUCT_CATALOG) {
        try {
          let printFileUrl = sourceImageUrl;
          if (sourceImageUrl) {
            try {
              printFileUrl = await this.imageNormalizationService.normalizeForProduct(
                sourceImageUrl, sku.productType, merchDropId,
              );
            } catch (err) {
              this.logger.warn(`Image normalization failed for ${sku.productType}, using original: ${err.message}`);
            }
          }

          const variants = getAllVariants(sku);

          const isGarment = sku.productType !== 'POSTER';
          const placement = isGarment ? 'front' : 'default';
          const technique = isGarment ? 'dtg' : 'digital';

          const printfulVariants: Array<{
            variant_id: number;
            retail_price: string;
            placement: string;
            technique: string;
            file_url: string;
          }> = [];

          for (const variant of variants) {
            const printfulVariantId = await this.printfulCatalogService.resolveVariantId(
              sku.printfulCatalogProductId, variant.size, variant.color,
            );

            const product = new MerchProduct();
            product.merch_drop_id = merchDropId;
            product.product_type = sku.productType;
            product.retail_price = variant.price;
            product.size = variant.size;
            product.color = variant.color;
            product.color_code = variant.colorCode;
            product.printful_catalog_product_id = sku.printfulCatalogProductId;
            product.printful_variant_id = printfulVariantId;
            product.image_url = printFileUrl;

            await this.merchProductRepo.save(product);
            createdCount++;

            if (printfulVariantId) {
              printfulVariants.push({
                variant_id: printfulVariantId,
                retail_price: variant.price.toFixed(2),
                placement,
                technique,
                file_url: printFileUrl,
              });
            }
          }

          if (printfulVariants.length > 0) {
            try {
              const syncProduct = await this.printfulService.createSyncProduct({
                name: `${sku.name} - Drop ${merchDropId.slice(0, 8)}`,
                thumbnail: printFileUrl,
                variants: printfulVariants,
              });

              const printfulProductId = syncProduct?.data?.id || syncProduct?.result?.id;
              if (printfulProductId) {
                await this.merchProductRepo
                  .createQueryBuilder()
                  .update(MerchProduct)
                  .set({ printful_product_id: printfulProductId })
                  .where('merch_drop_id = :merchDropId AND product_type = :productType', {
                    merchDropId,
                    productType: sku.productType,
                  })
                  .execute();
              }
            } catch (err) {
              this.logger.error(`Printful sync product creation failed for ${sku.productType}: ${err.message}`);
            }
          }

          this.logger.log(`Created ${variants.length} ${sku.productType} variants for drop ${merchDropId}`);
        } catch (error) {
          this.logger.error(`Failed to create ${sku.productType} for drop ${merchDropId}: ${error.message}`);
        }
      }

      await this.merchService.activateMerchDrop(merchDropId);
      this.logger.log(`Drop ${merchDropId} activated with ${createdCount} product variants`);

      try {
        const artistPlayerIds = await this.userDeviceService.getActivePlayerIds(artistId);
        if (artistPlayerIds.length > 0) {
          await this.pushNotificationService.sendPushNotification(
            artistPlayerIds, 'DayOnes', 'Your merch drop is now live!',
            { type: 'merch_drop', drop_id: merchDropId, post_id: artistPostId },
          );
        }
      } catch (notifErr) {
        this.logger.warn(`Artist drop activation notification failed: ${notifErr.message}`);
      }

      // Fan-side follow-up: notify every fan who got invited or already
      // accepted this drop that the matching merch is now available. Without
      // this step the fan side of the loop is silent: artist gets a push,
      // fans see nothing and the merch never converts.
      try {
        const fans = await this.artistPostUserRepo.find({
          where: {
            artist_post_id: artistPostId,
            status: In([Invite_Status.ACCEPTED, Invite_Status.PENDING, Invite_Status.GENERIC]),
            user_id: Not(artistId),
          },
        });
        this.logger.log(
          `[FAN_MERCH_NOTIFY] Notifying ${fans.length} fans for merch drop ${merchDropId} (post ${artistPostId})`,
        );
        let notified = 0;
        for (const fan of fans) {
          try {
            const tokens = await this.userDeviceService.getActivePlayerIds(fan.user_id);
            if (tokens.length === 0) continue;
            await this.pushNotificationService.sendPushNotification(
              tokens,
              'DayOnes merch is live',
              'Your DayOnes merch from this drop is ready, tap to grab it before it goes.',
              {
                type: 'merch_drop',
                drop_id: merchDropId,
                post_id: artistPostId,
              },
            );
            notified += 1;
          } catch (fanErr: any) {
            this.logger.warn(
              `[FAN_MERCH_NOTIFY] Failed for fan ${fan.user_id}: ${fanErr?.message}`,
            );
          }
        }
        this.logger.log(`[FAN_MERCH_NOTIFY] Sent fan push to ${notified}/${fans.length}`);
      } catch (fanNotifyErr: any) {
        this.logger.warn(
          `[FAN_MERCH_NOTIFY] Fan notification batch failed: ${fanNotifyErr?.message}`,
        );
      }
    } catch (error) {
      this.logger.error(`Merch creation job failed: ${error.message}`);
      throw error;
    }
  }
}
