import { MigrationInterface, QueryRunner } from "typeorm";

export class Reactions1727727845186 implements MigrationInterface {
    name = 'Reactions1727727845186'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "comments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "artist_post_user_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_8bf68bc960f2b69e818bdb90dcb" UNIQUE ("id"), CONSTRAINT "PK_8bf68bc960f2b69e818bdb90dcb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_94f65d2b59625921cbf8a1edb6" ON "comments" ("artist_post_user_id") `);
        await queryRunner.query(`CREATE TABLE "reactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "artist_post_user_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_0b213d460d0c473bc2fb6ee27f3" UNIQUE ("id"), CONSTRAINT "REL_8f44eacd8611c2d11c283cb2c8" UNIQUE ("artist_post_user_id"), CONSTRAINT "PK_0b213d460d0c473bc2fb6ee27f3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8f44eacd8611c2d11c283cb2c8" ON "reactions" ("artist_post_user_id") `);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_94f65d2b59625921cbf8a1edb67" FOREIGN KEY ("artist_post_user_id") REFERENCES "artist_post_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reactions" ADD CONSTRAINT "FK_8f44eacd8611c2d11c283cb2c8a" FOREIGN KEY ("artist_post_user_id") REFERENCES "artist_post_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reactions" DROP CONSTRAINT "FK_8f44eacd8611c2d11c283cb2c8a"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_94f65d2b59625921cbf8a1edb67"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8f44eacd8611c2d11c283cb2c8"`);
        await queryRunner.query(`DROP TABLE "reactions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_94f65d2b59625921cbf8a1edb6"`);
        await queryRunner.query(`DROP TABLE "comments"`);
    }

}
