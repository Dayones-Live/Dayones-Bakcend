import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUserDevicesTable1748991540676 implements MigrationInterface {
    name = 'CreateUserDevicesTable1748991540676'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "user_devices" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "onesignal_player_id" character varying NOT NULL,
                "device_type" character varying NOT NULL,
                "device_token" character varying,
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_user_devices" PRIMARY KEY ("id"),
                CONSTRAINT "FK_user_devices_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "user_devices"`);
    }
}
