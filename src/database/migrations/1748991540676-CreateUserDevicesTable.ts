import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUserDevicesTable1748991540676 implements MigrationInterface {
    name = 'CreateUserDevicesTable1748991540676'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('user_devices');
        if (!tableExists) {
            await queryRunner.query(`
                CREATE TABLE "user_devices" (
                    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                    "user_id" uuid NOT NULL,
                    "device_token" character varying NOT NULL,
                    "device_type" character varying NOT NULL,
                    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                    CONSTRAINT "PK_user_devices" PRIMARY KEY ("id")
                )
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('user_devices');
        if (tableExists) {
            await queryRunner.query(`DROP TABLE "user_devices"`);
        }
    }
}
