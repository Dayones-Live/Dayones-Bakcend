import { MigrationInterface, QueryRunner } from "typeorm";

export class ArtistPostEntityUpdate1727952614074 implements MigrationInterface {
    name = 'ArtistPostEntityUpdate1727952614074'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "artist_post" ADD "longitude" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "artist_post" ADD "latitude" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "artist_post" ADD "locale" character varying NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "artist_post" DROP COLUMN "locale"`);
        await queryRunner.query(`ALTER TABLE "artist_post" DROP COLUMN "latitude"`);
        await queryRunner.query(`ALTER TABLE "artist_post" DROP COLUMN "longitude"`);
    }

}