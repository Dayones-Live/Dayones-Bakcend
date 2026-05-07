import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class WebhookDedupService {
  private readonly logger = new Logger(WebhookDedupService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Returns true if this is a NEW event (and atomically marks it processed).
   * Returns false if the event was already seen — the caller MUST skip processing.
   */
  async claim({
    provider,
    externalId,
    eventType,
    payloadHash,
  }: {
    provider: string;
    externalId: string;
    eventType?: string;
    payloadHash?: string;
  }): Promise<boolean> {
    try {
      const result = await this.dataSource.query(
        `INSERT INTO "webhook_event" ("provider", "external_id", "event_type", "payload_hash")
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ("provider", "external_id") DO NOTHING
         RETURNING id`,
        [provider, externalId, eventType ?? null, payloadHash ?? null],
      );
      return Array.isArray(result) && result.length > 0;
    } catch (e) {
      this.logger.warn(`Webhook dedup error for ${provider}/${externalId}: ${(e as Error).message}`);
      return true;
    }
  }
}
