import { MigrationInterface, QueryRunner } from "typeorm";

export class GenericPost1729757165426 implements MigrationInterface {
    name = 'GenericPost1729757165426'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "artist_post_user" ALTER COLUMN "valid_till" DROP NOT NULL`);
        await queryRunner.query(`ALTER TYPE "public"."artist_post_user_status_enum" RENAME TO "artist_post_user_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."artist_post_user_status_enum" AS ENUM('ACCEPTED', 'REJECTED', 'PENDING', 'GENERIC', 'NULL')`);
        await queryRunner.query(`ALTER TABLE "artist_post_user" ALTER COLUMN "status" TYPE "public"."artist_post_user_status_enum" USING "status"::"text"::"public"."artist_post_user_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."artist_post_user_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "artist_post" ALTER COLUMN "image_url" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "artist_post" ALTER COLUMN "range" DROP NOT NULL`);
        await queryRunner.query(`ALTER TYPE "public"."artist_post_type_enum" RENAME TO "artist_post_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."artist_post_type_enum" AS ENUM('INVITE_PHOTO', 'INVITE_ONLY', 'GENERIC')`);
        await queryRunner.query(`ALTER TABLE "artist_post" ALTER COLUMN "type" TYPE "public"."artist_post_type_enum" USING "type"::"text"::"public"."artist_post_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."artist_post_type_enum_old"`);
        await queryRunner.query(`ALTER TABLE "artist_post" ALTER COLUMN "longitude" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "artist_post" ALTER COLUMN "latitude" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "artist_post" ALTER COLUMN "locale" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "artist_post" ALTER COLUMN "locale" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "artist_post" ALTER COLUMN "latitude" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "artist_post" ALTER COLUMN "longitude" SET NOT NULL`);
        await queryRunner.query(`CREATE TYPE "public"."artist_post_type_enum_old" AS ENUM('INVITE_PHOTO', 'INVITE_ONLY')`);
        await queryRunner.query(`ALTER TABLE "artist_post" ALTER COLUMN "type" TYPE "public"."artist_post_type_enum_old" USING "type"::"text"::"public"."artist_post_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."artist_post_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."artist_post_type_enum_old" RENAME TO "artist_post_type_enum"`);
        await queryRunner.query(`ALTER TABLE "artist_post" ALTER COLUMN "range" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "artist_post" ALTER COLUMN "image_url" SET NOT NULL`);
        await queryRunner.query(`CREATE TYPE "public"."artist_post_user_status_enum_old" AS ENUM('ACCEPTED', 'REJECTED', 'PENDING', 'NULL')`);
        await queryRunner.query(`ALTER TABLE "artist_post_user" ALTER COLUMN "status" TYPE "public"."artist_post_user_status_enum_old" USING "status"::"text"::"public"."artist_post_user_status_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."artist_post_user_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."artist_post_user_status_enum_old" RENAME TO "artist_post_user_status_enum"`);
        await queryRunner.query(`ALTER TABLE "artist_post_user" ALTER COLUMN "valid_till" SET NOT NULL`);
    }

}
