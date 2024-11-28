import { MigrationInterface, QueryRunner } from "typeorm";

export class UserEntityIsActive1732624372823 implements MigrationInterface {
    name = 'UserEntityIsActive1732624372823'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "is_deleted" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "is_deleted"`);
    }

}
