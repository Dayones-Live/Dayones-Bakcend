import { MigrationInterface, QueryRunner } from "typeorm";

export class UserEntityUpdate1732641923664 implements MigrationInterface {
    name = 'UserEntityUpdate1732641923664'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "phone_number" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "phone_number" SET NOT NULL`);
    }

}
