export enum MerchDropStatus {
  CREATING = 'CREATING',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum ProductType {
  TSHIRT = 'TSHIRT',
  HOODIE = 'HOODIE',
  TANK = 'TANK',
  POSTER = 'POSTER',
  HAT = 'HAT',
}

export enum MerchOrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  PRODUCTION = 'PRODUCTION',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
}

export enum LedgerStatus {
  PENDING = 'PENDING',
  CALCULATED = 'CALCULATED',
  PAID_OUT = 'PAID_OUT',
  REVERSED = 'REVERSED',
}

export enum PayoutBatchStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}
