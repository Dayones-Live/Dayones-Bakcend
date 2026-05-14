import { DocumentBuilder } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('DayOnes API')
  .setDescription(
    'OpenAPI 3 contract for the DayOnes mobile client. This document is the single source of truth — the Flutter client is code-generated from it.',
  )
  .setVersion('1.0.0')
  .addServer('/api/v1', 'API base path')
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'Authorization',
      in: 'header',
      description: 'Cognito access token issued by /auth/signin or /auth/token',
    },
    'bearer',
  )
  .addTag('auth', 'Authentication, signup, signin, token refresh')
  .addTag('post', 'Artist posts (legacy controller name in code is "post"; mobile clients see this as artist posts)')
  .addTag('comment', 'Post comments')
  .addTag('reaction', 'Post reactions (likes)')
  .addTag('signature', 'Artist autograph signatures')
  .addTag('conversation', 'Direct message conversations')
  .addTag('message', 'Direct message bodies')
  .addTag('blocks', 'User blocking')
  .addTag('report', 'Content reporting')
  .addTag('invites', 'Pre-launch invitation codes')
  .addTag('profile', 'User profile + gallery')
  .addTag('user', 'User account management')
  .addTag('devices', 'Device + push token registration')
  .addTag('user-notification', 'Per-user push notification preferences')
  .addTag('notifications', 'In-app notification feed')
  .addTag('feedback', 'User feedback submissions')
  .addTag('merch', 'Merch drops, orders, payouts')
  .addTag('artist-dashboard', 'Artist analytics + stats')
  .addTag('stripe', 'Stripe Connect onboarding + status + webhooks')
  .addTag('printful', 'Printful fulfillment webhooks')
  .addTag('s3', 'Direct upload presigned URLs')
  .addTag('health', 'Server health check')
  .build();
