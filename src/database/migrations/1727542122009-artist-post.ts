import { MigrationInterface, QueryRunner } from "typeorm";

export class ArtistPost1727542122009 implements MigrationInterface {
    name = 'ArtistPost1727542122009'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."artist_post_type_enum" AS ENUM('photo', 'invite', 'both')`);
        await queryRunner.query(`CREATE TABLE "artist_post" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "message" character varying, "image_url" character varying NOT NULL, "range" integer NOT NULL, "type" "public"."artist_post_type_enum" NOT NULL, CONSTRAINT "UQ_04ab30954ee3a34f1b873574bf1" UNIQUE ("id"), CONSTRAINT "PK_04ab30954ee3a34f1b873574bf1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5174f7d202a1b3612c1ced8887" ON "artist_post" ("user_id") `);
        await queryRunner.query(`ALTER TABLE "signatures" ADD CONSTRAINT "UQ_f56eb3cd344ce7f9ae28ce814eb" UNIQUE ("id")`);
        await queryRunner.query(`ALTER TABLE "artist_post" ADD CONSTRAINT "FK_5174f7d202a1b3612c1ced8887c" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "artist_post" DROP CONSTRAINT "FK_5174f7d202a1b3612c1ced8887c"`);
        await queryRunner.query(`ALTER TABLE "signatures" DROP CONSTRAINT "UQ_f56eb3cd344ce7f9ae28ce814eb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5174f7d202a1b3612c1ced8887"`);
        await queryRunner.query(`DROP TABLE "artist_post"`);
        await queryRunner.query(`DROP TYPE "public"."artist_post_type_enum"`);
    }

}
