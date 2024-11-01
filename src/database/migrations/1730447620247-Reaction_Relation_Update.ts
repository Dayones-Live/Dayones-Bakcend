import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReactionRelationUpdate1730447620247 implements MigrationInterface {
  name = 'ReactionRelationUpdate1730447620247';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reactions" DROP CONSTRAINT "FK_8f44eacd8611c2d11c283cb2c8a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reactions" ADD CONSTRAINT "UQ_0b213d460d0c473bc2fb6ee27f3" UNIQUE ("id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "reactions" DROP CONSTRAINT "REL_8f44eacd8611c2d11c283cb2c8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reactions" ADD CONSTRAINT "FK_8f44eacd8611c2d11c283cb2c8a" FOREIGN KEY ("artist_post_user_id") REFERENCES "artist_post_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reactions" DROP CONSTRAINT "FK_8f44eacd8611c2d11c283cb2c8a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reactions" ADD CONSTRAINT "REL_8f44eacd8611c2d11c283cb2c8" UNIQUE ("artist_post_user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "reactions" DROP CONSTRAINT "UQ_0b213d460d0c473bc2fb6ee27f3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reactions" ADD CONSTRAINT "FK_8f44eacd8611c2d11c283cb2c8a" FOREIGN KEY ("artist_post_user_id") REFERENCES "artist_post_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
