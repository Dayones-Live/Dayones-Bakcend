import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDropDurationToArtistPost1779000000000 implements MigrationInterface {
  name = 'AddDropDurationToArtistPost1779000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "artist_post"
      ADD COLUMN IF NOT EXISTS "drop_duration_minutes" INTEGER
    `);
    await queryRunner.query(`
      UPDATE "artist_post"
      SET "drop_duration_minutes" = 240
      WHERE "drop_duration_minutes" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "artist_post" DROP COLUMN IF EXISTS "drop_duration_minutes"
    `);
  }
}
