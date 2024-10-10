import { MigrationInterface, QueryRunner } from "typeorm";

export class UserEntityUpdate1728558626240 implements MigrationInterface {
    name = 'UserEntityUpdate1728558626240'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "notifications_enabled" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "user" ADD "notification_status_valid_till" TIMESTAMP DEFAULT now()`);
        await queryRunner.query(`CREATE INDEX "IDX_3fc44e1280c095a8a86a782bb0" ON "user" ("notifications_enabled") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {

        await queryRunner.query(`DROP INDEX "public"."IDX_3fc44e1280c095a8a86a782bb0"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "notification_status_valid_till"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "notifications_enabled"`);
    }

}
