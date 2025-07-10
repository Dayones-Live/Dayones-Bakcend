import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPendingApprovalToUser1749000000000 implements MigrationInterface {
    name = 'AddPendingApprovalToUser1749000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "pending_approval" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "pending_approval"`);
    }
} 