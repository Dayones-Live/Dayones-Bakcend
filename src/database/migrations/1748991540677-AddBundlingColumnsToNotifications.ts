import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBundlingColumnsToNotifications1748991540677 implements MigrationInterface {
    name = 'AddBundlingColumnsToNotifications1748991540677'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notifications" ADD "is_bundled" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD "bundled_notification_id" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_notifications_bundled" ON "notifications" ("is_bundled")`);
        await queryRunner.query(`CREATE INDEX "IDX_notifications_bundled_id" ON "notifications" ("bundled_notification_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_notifications_bundled_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_notifications_bundled"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "bundled_notification_id"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "is_bundled"`);
    }
} 