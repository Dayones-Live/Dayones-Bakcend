import { MigrationInterface, QueryRunner } from "typeorm";

export class ArtistPostUserEntityUpdate1728638328719 implements MigrationInterface {
    name = 'ArtistPostUserEntityUpdate1728638328719'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."artist_post_user_status_enum" RENAME TO "artist_post_user_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."artist_post_user_status_enum" AS ENUM('ACCEPTED', 'REJECTED', 'PENDING', 'NULL')`);
        await queryRunner.query(`ALTER TABLE "artist_post_user" ALTER COLUMN "status" TYPE "public"."artist_post_user_status_enum" USING "status"::"text"::"public"."artist_post_user_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."artist_post_user_status_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."artist_post_user_status_enum_old" AS ENUM('ACCEPTED', 'REJECTED', 'PENDING')`);
        await queryRunner.query(`ALTER TABLE "artist_post_user" ALTER COLUMN "status" TYPE "public"."artist_post_user_status_enum_old" USING "status"::"text"::"public"."artist_post_user_status_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."artist_post_user_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."artist_post_user_status_enum_old" RENAME TO "artist_post_user_status_enum"`);
    }

}
