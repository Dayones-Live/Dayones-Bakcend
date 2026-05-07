import { MigrationInterface, QueryRunner } from 'typeorm';

export class B2DataIntegrity1778200000000 implements MigrationInterface {
  name = 'B2DataIntegrity1778200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "webhook_event" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "provider" VARCHAR(32) NOT NULL,
        "external_id" VARCHAR(256) NOT NULL,
        "event_type" VARCHAR(128),
        "payload_hash" VARCHAR(64),
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_webhook_event_provider_external"
        ON "webhook_event" ("provider", "external_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "merch_order" ALTER COLUMN "subtotal" TYPE NUMERIC(18,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "merch_order" ALTER COLUMN "total" TYPE NUMERIC(18,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "merch_order" ALTER COLUMN "shipping_cost" TYPE NUMERIC(18,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "merch_order_item" ALTER COLUMN "unit_price" TYPE NUMERIC(18,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "order_ledger" ALTER COLUMN "amount" TYPE NUMERIC(18,4)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_merch_order_user_status_created"
        ON "merch_order" ("user_id", "status", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_merch_drop_artist_status"
        ON "merch_drop" ("artist_id", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_artist_post_user_post_status"
        ON "artist_post_user" ("artist_post_id", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_artist_post_user_user_status"
        ON "artist_post_user" ("user_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_user_role_deleted"
        ON "user" ("role", "is_deleted")
        WHERE "is_deleted" = false OR "is_deleted" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_role_deleted"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_artist_post_user_user_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_artist_post_user_post_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_merch_drop_artist_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_merch_order_user_status_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_webhook_event_provider_external"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_event"`);
  }
}
