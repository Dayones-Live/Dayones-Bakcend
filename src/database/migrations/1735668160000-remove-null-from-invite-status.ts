import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveNullFromInviteStatus1735668160000 implements MigrationInterface {
    name = 'RemoveNullFromInviteStatus1735668160000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // First, update any existing records with 'NULL' status to 'PENDING'
        await queryRunner.query(`UPDATE "artist_post_user" SET "status" = 'PENDING' WHERE "status" = 'NULL'`);
        
        // Remove the 'NULL' value from the enum
        await queryRunner.query(`ALTER TYPE "public"."artist_post_user_status_enum" RENAME TO "artist_post_user_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."artist_post_user_status_enum" AS ENUM('ACCEPTED', 'REJECTED', 'PENDING', 'GENERIC')`);
        await queryRunner.query(`ALTER TABLE "artist_post_user" ALTER COLUMN "status" TYPE "public"."artist_post_user_status_enum" USING "status"::"text"::"public"."artist_post_user_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."artist_post_user_status_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Add the 'NULL' value back to the enum
        await queryRunner.query(`ALTER TYPE "public"."artist_post_user_status_enum" RENAME TO "artist_post_user_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."artist_post_user_status_enum" AS ENUM('ACCEPTED', 'REJECTED', 'PENDING', 'GENERIC', 'NULL')`);
        await queryRunner.query(`ALTER TABLE "artist_post_user" ALTER COLUMN "status" TYPE "public"."artist_post_user_status_enum" USING "status"::"text"::"public"."artist_post_user_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."artist_post_user_status_enum_old"`);
    }
}
