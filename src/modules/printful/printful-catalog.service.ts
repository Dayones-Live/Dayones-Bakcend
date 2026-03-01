import { Injectable, Logger } from '@nestjs/common';
import { PrintfulService } from './printful.service';

interface CatalogVariant {
  id: number;
  size: string;
  color: string;
  colorCode: string;
}

@Injectable()
export class PrintfulCatalogService {
  private readonly logger = new Logger(PrintfulCatalogService.name);
  private readonly variantCache = new Map<number, CatalogVariant[]>();

  constructor(private printfulService: PrintfulService) {}

  async resolveVariantId(catalogProductId: number, size: string, color: string | null): Promise<number | null> {
    const variants = await this.getVariants(catalogProductId);

    const sizeNorm = size.trim().toUpperCase();
    const colorNorm = color?.trim().toLowerCase() || null;

    let match = variants.find(
      (v) => v.size.toUpperCase() === sizeNorm && (colorNorm === null || v.color.toLowerCase() === colorNorm),
    );

    if (!match && colorNorm) {
      match = variants.find(
        (v) => v.size.toUpperCase() === sizeNorm && v.color.toLowerCase().includes(colorNorm),
      );
    }

    if (!match && colorNorm) {
      match = variants.find(
        (v) => v.size.toUpperCase() === sizeNorm && colorNorm.includes(v.color.toLowerCase()),
      );
    }

    if (!match) {
      this.logger.warn(`No variant found for product ${catalogProductId}, size=${size}, color=${color}`);
      return null;
    }

    return match.id;
  }

  private async getVariants(catalogProductId: number): Promise<CatalogVariant[]> {
    if (this.variantCache.has(catalogProductId)) {
      return this.variantCache.get(catalogProductId);
    }

    try {
      const response = await this.printfulService.getCatalogVariants(catalogProductId);
      const variants: CatalogVariant[] = (response?.result || []).map((v: any) => ({
        id: v.id,
        size: v.size || '',
        color: v.color || '',
        colorCode: v.color_code || '',
      }));

      this.variantCache.set(catalogProductId, variants);
      this.logger.log(`Cached ${variants.length} variants for catalog product ${catalogProductId}`);
      return variants;
    } catch (error) {
      this.logger.error(`Failed to fetch variants for product ${catalogProductId}: ${error.message}`);
      return [];
    }
  }
}
