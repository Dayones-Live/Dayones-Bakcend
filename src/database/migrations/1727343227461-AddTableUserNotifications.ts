import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTableUserNotifications1727343227461 implements MigrationInterface {
    name = 'AddTableUserNotifications1727343227461'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user-notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "notification_token" character varying NOT NULL, CONSTRAINT "UQ_d77ca46b49c096a28be5c812cfe" UNIQUE ("id"), CONSTRAINT "REL_08c8122b09dd91bcd30a51c978" UNIQUE ("user_id"), CONSTRAINT "PK_d77ca46b49c096a28be5c812cfe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_08c8122b09dd91bcd30a51c978" ON "user-notifications" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_eae8863301f24f3205295263bc" ON "user-notifications" ("notification_token") `);
        await queryRunner.query(`ALTER TABLE "user-notifications" ADD CONSTRAINT "FK_08c8122b09dd91bcd30a51c978a" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user-notifications" DROP CONSTRAINT "FK_08c8122b09dd91bcd30a51c978a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_eae8863301f24f3205295263bc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_08c8122b09dd91bcd30a51c978"`);
        await queryRunner.query(`DROP TABLE "user-notifications"`);
    }

}
