export enum StripeWebhookEvents {
  PAYMENT_INTENT_SUCCEEDED = 'payment_intent.succeeded',
  PAYMENT_INTENT_FAILED = 'payment_intent.payment_failed',
  CHARGE_REFUNDED = 'charge.refunded',
  CHARGE_DISPUTE_CREATED = 'charge.dispute.created',
  ACCOUNT_UPDATED = 'account.updated',
}
