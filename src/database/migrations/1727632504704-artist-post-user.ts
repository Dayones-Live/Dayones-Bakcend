import { MigrationInterface, QueryRunner } from "typeorm";

export class ArtistPostUser1727632504704 implements MigrationInterface {
    name = 'ArtistPostUser1727632504704'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."artist_post_user_status_enum" AS ENUM('accept', 'reject', 'pending')`);
        await queryRunner.query(`CREATE TABLE "artist_post_user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "artist_post_id" uuid NOT NULL, "valid_till" TIMESTAMP NOT NULL, "status" "public"."artist_post_user_status_enum" NOT NULL, CONSTRAINT "UQ_5174f7d202a1b3612c1ced8887c" UNIQUE ("id"), CONSTRAINT "PK_5174f7d202a1b3612c1ced8887c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_38d70635afae49ad17ce1b4795" ON "artist_post_user" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_14a2b91190d608f7efcd91cab3" ON "artist_post_user" ("artist_post_id") `);
        await queryRunner.query(`ALTER TABLE "artist_post_user" ADD CONSTRAINT "FK_38d70635afae49ad17ce1b47955" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "artist_post_user" ADD CONSTRAINT "FK_14a2b91190d608f7efcd91cab35" FOREIGN KEY ("artist_post_id") REFERENCES "artist_post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "artist_post_user" DROP CONSTRAINT "FK_14a2b91190d608f7efcd91cab35"`);
        await queryRunner.query(`ALTER TABLE "artist_post_user" DROP CONSTRAINT "FK_38d70635afae49ad17ce1b47955"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_14a2b91190d608f7efcd91cab3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_38d70635afae49ad17ce1b4795"`);
        await queryRunner.query(`DROP TABLE "artist_post_user"`);
        await queryRunner.query(`DROP TYPE "public"."artist_post_user_status_enum"`);
    }

}
