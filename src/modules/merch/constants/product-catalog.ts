import { ProductType } from './index';

export interface SkuColorConfig {
  name: string;
  hex: string;
}

export interface SkuPriceTier {
  sizes: string[];
  price: number;
}

export interface SkuConfig {
  productType: ProductType;
  name: string;
  blankName: string;
  printfulCatalogProductId: number;
  priceTiers: SkuPriceTier[];
  colors: SkuColorConfig[];
  printCanvasWidth: number;
  printCanvasHeight: number;
}

export const PRODUCT_CATALOG: SkuConfig[] = [
  {
    productType: ProductType.HOODIE,
    name: 'Tour Autograph Hoodie',
    blankName: 'Cotton Heritage M2580',
    printfulCatalogProductId: 380,
    priceTiers: [
      { sizes: ['S', 'M', 'L', 'XL'], price: 80 },
      { sizes: ['2XL', '3XL'], price: 85 },
    ],
    colors: [
      { name: 'Black', hex: '#080808' },
      { name: 'White', hex: '#ffffff' },
      { name: 'Carbon Grey', hex: '#c7c3be' },
    ],
    printCanvasWidth: 3600,
    printCanvasHeight: 2400,
  },
  {
    productType: ProductType.TSHIRT,
    name: 'Tour Autograph Tee',
    blankName: 'Bella+Canvas 3001',
    printfulCatalogProductId: 71,
    priceTiers: [
      { sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL'], price: 40 },
      { sizes: ['3XL', '4XL', '5XL'], price: 45 },
    ],
    colors: [
      { name: 'Black', hex: '#0b0b0b' },
      { name: 'White', hex: '#ffffff' },
      { name: 'Athletic Heather', hex: '#cececc' },
    ],
    printCanvasWidth: 3600,
    printCanvasHeight: 2400,
  },
  {
    productType: ProductType.TANK,
    name: 'Tour Autograph Tank',
    blankName: 'Bella+Canvas 3480',
    printfulCatalogProductId: 248,
    priceTiers: [
      { sizes: ['S', 'M', 'L'], price: 35 },
      { sizes: ['XL', '2XL'], price: 40 },
    ],
    colors: [
      { name: 'Black', hex: '#131212' },
      { name: 'White', hex: '#ffffff' },
      { name: 'Athletic Heather', hex: '#AAA1A2' },
    ],
    printCanvasWidth: 3000,
    printCanvasHeight: 2000,
  },
  {
    productType: ProductType.POSTER,
    name: 'Tour Autograph Poster',
    blankName: 'Enhanced Matte Paper Poster (in)',
    printfulCatalogProductId: 1,
    priceTiers: [
      { sizes: ['18x24'], price: 35 },
    ],
    colors: [],
    printCanvasWidth: 5400,
    printCanvasHeight: 7200,
  },
];

export function getRetailPrice(sku: SkuConfig, size: string): number {
  for (const tier of sku.priceTiers) {
    if (tier.sizes.includes(size)) return tier.price;
  }
  return sku.priceTiers[0].price;
}

export function getAllVariants(sku: SkuConfig): Array<{ size: string; color: string | null; colorCode: string | null; price: number }> {
  const variants: Array<{ size: string; color: string | null; colorCode: string | null; price: number }> = [];
  const allSizes = sku.priceTiers.flatMap((t) => t.sizes);

  if (sku.colors.length === 0) {
    for (const size of allSizes) {
      variants.push({ size, color: null, colorCode: null, price: getRetailPrice(sku, size) });
    }
  } else {
    for (const size of allSizes) {
      for (const color of sku.colors) {
        variants.push({ size, color: color.name, colorCode: color.hex, price: getRetailPrice(sku, size) });
      }
    }
  }
  return variants;
}
