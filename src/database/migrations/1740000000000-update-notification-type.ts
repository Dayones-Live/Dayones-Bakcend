import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateNotificationType1740000000000 implements MigrationInterface {
    name = 'UpdateNotificationType1740000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "notifications" 
            ALTER COLUMN "type" TYPE varchar(255)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "notifications" 
            ALTER COLUMN "type" TYPE varchar(50)
        `);
    }
} 