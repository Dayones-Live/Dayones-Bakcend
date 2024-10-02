import { MigrationInterface, QueryRunner } from "typeorm";

export class InviteAndPostEnumUpdate1727881752754 implements MigrationInterface {
    name = 'InviteAndPostEnumUpdate1727881752754'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."artist_post_user_status_enum" RENAME TO "artist_post_user_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."artist_post_user_status_enum" AS ENUM('ACCEPTED', 'REJECTED', 'PENDING')`);
        await queryRunner.query(`ALTER TABLE "artist_post_user" ALTER COLUMN "status" TYPE "public"."artist_post_user_status_enum" USING "status"::"text"::"public"."artist_post_user_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."artist_post_user_status_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."artist_post_type_enum" RENAME TO "artist_post_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."artist_post_type_enum" AS ENUM('INVITE_PHOTO', 'INVITE_ONLY')`);
        await queryRunner.query(`ALTER TABLE "artist_post" ALTER COLUMN "type" TYPE "public"."artist_post_type_enum" USING "type"::"text"::"public"."artist_post_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."artist_post_type_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."artist_post_type_enum_old" AS ENUM('photo', 'invite', 'both')`);
        await queryRunner.query(`ALTER TABLE "artist_post" ALTER COLUMN "type" TYPE "public"."artist_post_type_enum_old" USING "type"::"text"::"public"."artist_post_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."artist_post_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."artist_post_type_enum_old" RENAME TO "artist_post_type_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."artist_post_user_status_enum_old" AS ENUM('accept', 'reject', 'pending')`);
        await queryRunner.query(`ALTER TABLE "artist_post_user" ALTER COLUMN "status" TYPE "public"."artist_post_user_status_enum_old" USING "status"::"text"::"public"."artist_post_user_status_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."artist_post_user_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."artist_post_user_status_enum_old" RENAME TO "artist_post_user_status_enum"`);
    }

}
