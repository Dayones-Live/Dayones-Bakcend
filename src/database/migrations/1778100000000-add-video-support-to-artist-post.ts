import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVideoSupportToArtistPost1778100000000 implements MigrationInterface {
  name = 'AddVideoSupportToArtistPost1778100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "artist_post"
      ADD COLUMN IF NOT EXISTS "video_url" VARCHAR
    `);
    await queryRunner.query(`
      ALTER TABLE "artist_post"
      ADD COLUMN IF NOT EXISTS "media_type" VARCHAR(16) NOT NULL DEFAULT 'image'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_artist_post_media_type" ON "artist_post" ("media_type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_artist_post_media_type"`);
    await queryRunner.query(`ALTER TABLE "artist_post" DROP COLUMN IF EXISTS "media_type"`);
    await queryRunner.query(`ALTER TABLE "artist_post" DROP COLUMN IF EXISTS "video_url"`);
  }
}
