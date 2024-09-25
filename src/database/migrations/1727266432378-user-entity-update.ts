import { MigrationInterface, QueryRunner } from "typeorm";

export class UserEntityUpdate1727266432378 implements MigrationInterface {
    name = 'UserEntityUpdate1727266432378'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "latitude" character varying`);
        await queryRunner.query(`ALTER TABLE "user" ADD "longitude" character varying`);
        await queryRunner.query(`ALTER TABLE "user" ADD "avatar_url" character varying`);
        await queryRunner.query(`ALTER TABLE "user" ADD "notification_token" character varying`);
        await queryRunner.query(`ALTER TABLE "user" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "user" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TYPE "public"."user_role_enum" RENAME TO "user_role_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."user_role_enum" AS ENUM('USER', 'ARTIST')`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "role" TYPE "public"."user_role_enum"[] USING "role"::"text"::"public"."user_role_enum"[]`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT '{USER}'`);
        await queryRunner.query(`DROP TYPE "public"."user_role_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."user_role_enum_old" AS ENUM('ADMIN', 'USER', 'ARTIST')`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "role" TYPE "public"."user_role_enum_old"[] USING "role"::"text"::"public"."user_role_enum_old"[]`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT '{USER}'`);
        await queryRunner.query(`DROP TYPE "public"."user_role_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."user_role_enum_old" RENAME TO "user_role_enum"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "notification_token"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "avatar_url"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "longitude"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "latitude"`);
    }

}
