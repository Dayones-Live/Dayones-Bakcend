import { MigrationInterface, QueryRunner } from "typeorm";

export class ArtistPostUserArtistPostTimeStamp1727633817814 implements MigrationInterface {
    name = 'ArtistPostUserArtistPostTimeStamp1727633817814'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "artist_post_user" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "artist_post_user" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "artist_post" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "artist_post" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "artist_post_user" ADD CONSTRAINT "UQ_5174f7d202a1b3612c1ced8887c" UNIQUE ("id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "artist_post_user" DROP CONSTRAINT "UQ_5174f7d202a1b3612c1ced8887c"`);
        await queryRunner.query(`ALTER TABLE "artist_post" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "artist_post" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "artist_post_user" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "artist_post_user" DROP COLUMN "created_at"`);
    }

}
