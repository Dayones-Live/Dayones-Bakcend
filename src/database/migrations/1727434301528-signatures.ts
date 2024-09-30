import { MigrationInterface, QueryRunner } from "typeorm";

export class Signatures1727434301528 implements MigrationInterface {
    name = 'Signatures1727434301528'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "signatures" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "url" character varying NOT NULL, CONSTRAINT "UQ_f56eb3cd344ce7f9ae28ce814eb" UNIQUE ("id"), CONSTRAINT "PK_f56eb3cd344ce7f9ae28ce814eb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c93e294b75e34b850a599a51e2" ON "signatures" ("user_id") `);
        await queryRunner.query(`ALTER TABLE "user-notifications" ADD CONSTRAINT "UQ_d77ca46b49c096a28be5c812cfe" UNIQUE ("id")`);
        await queryRunner.query(`ALTER TABLE "signatures" ADD CONSTRAINT "FK_c93e294b75e34b850a599a51e2c" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "signatures" DROP CONSTRAINT "FK_c93e294b75e34b850a599a51e2c"`);
        await queryRunner.query(`ALTER TABLE "user-notifications" DROP CONSTRAINT "UQ_d77ca46b49c096a28be5c812cfe"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c93e294b75e34b850a599a51e2"`);
        await queryRunner.query(`DROP TABLE "signatures"`);
    }

}
