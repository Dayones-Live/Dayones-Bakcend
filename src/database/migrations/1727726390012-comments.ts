import { MigrationInterface, QueryRunner } from "typeorm";

export class Comments1727726390012 implements MigrationInterface {
    name = 'Comments1727726390012'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "comments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "artist_post_user_id" uuid NOT NULL, "message" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_8bf68bc960f2b69e818bdb90dcb" UNIQUE ("id"), CONSTRAINT "PK_8bf68bc960f2b69e818bdb90dcb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_94f65d2b59625921cbf8a1edb6" ON "comments" ("artist_post_user_id") `);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_94f65d2b59625921cbf8a1edb67" FOREIGN KEY ("artist_post_user_id") REFERENCES "artist_post_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_94f65d2b59625921cbf8a1edb67"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_94f65d2b59625921cbf8a1edb6"`);
        await queryRunner.query(`DROP TABLE "comments"`);
    }

}
