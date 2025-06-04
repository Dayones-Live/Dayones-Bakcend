import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateNotificationType1728453772113 implements MigrationInterface {
    name = 'UpdateNotificationType1728453772113'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // First, update any existing 'comments' values to 'reaction' temporarily
        await queryRunner.query(`UPDATE "notifications" SET "type" = 'reaction' WHERE "type" = 'comments'`);
        
        // Then alter the enum type
        await queryRunner.query(`ALTER TYPE "public"."notifications_type_enum" RENAME TO "notifications_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum" AS ENUM('reaction', 'comment', 'invite', 'message')`);
        await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum" USING "type"::text::"public"."notifications_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // First, update any existing 'comment' values to 'reaction' temporarily
        await queryRunner.query(`UPDATE "notifications" SET "type" = 'reaction' WHERE "type" = 'comment'`);
        
        // Then alter the enum type back
        await queryRunner.query(`ALTER TYPE "public"."notifications_type_enum" RENAME TO "notifications_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum" AS ENUM('reaction', 'comments', 'invite', 'message')`);
        await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum" USING "type"::text::"public"."notifications_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum_old"`);
    }
} 