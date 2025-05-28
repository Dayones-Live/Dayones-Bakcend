import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPostAndConversationIdToNotifications1716923891000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications"
      ADD COLUMN IF NOT EXISTS "post_id" uuid,
      ADD COLUMN IF NOT EXISTS "conversation_id" uuid;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications"
      DROP COLUMN IF EXISTS "post_id",
      DROP COLUMN IF EXISTS "conversation_id";
    `);
  }
} 