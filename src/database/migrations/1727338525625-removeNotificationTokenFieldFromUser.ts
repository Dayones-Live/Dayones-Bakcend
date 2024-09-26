import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveNotificationTokenFieldFromUser1727338525625 implements MigrationInterface {
    name = 'RemoveNotificationTokenFieldFromUser1727338525625'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "notification_token"`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "email" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "phone_number" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "is_confirmed" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "is_confirmed" SET DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "user_sub" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "user_sub" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "is_confirmed" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "is_confirmed" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "phone_number" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "email" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ADD "notification_token" character varying`);
    }

}
