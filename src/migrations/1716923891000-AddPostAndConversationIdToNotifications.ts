import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPostAndConversationIdToNotifications1716923891000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add MESSAGE type to the enum first
    await queryRunner.query(`
      ALTER TYPE notifications_type_enum ADD VALUE IF NOT EXISTS 'MESSAGE';
    `);

    // Then add the new columns
    await queryRunner.query(`
      ALTER TABLE "notifications" 
      ADD COLUMN IF NOT EXISTS "post_id" uuid,
      ADD COLUMN IF NOT EXISTS "conversation_id" uuid,
      ADD CONSTRAINT "FK_notifications_post" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE,
      ADD CONSTRAINT "FK_notifications_conversation" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the foreign key constraints first
    await queryRunner.query(`
      ALTER TABLE "notifications" 
      DROP CONSTRAINT IF EXISTS "FK_notifications_post",
      DROP CONSTRAINT IF EXISTS "FK_notifications_conversation";
    `);

    // Then remove the columns
    await queryRunner.query(`
      ALTER TABLE "notifications" 
      DROP COLUMN IF EXISTS "post_id",
      DROP COLUMN IF EXISTS "conversation_id";
    `);

    // Note: We cannot remove the enum value as PostgreSQL doesn't support removing values from enums
  }
} 