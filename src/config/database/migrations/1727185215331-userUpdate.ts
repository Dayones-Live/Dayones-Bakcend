import { MigrationInterface, QueryRunner } from "typeorm";

export class UserUpdate1727185215331 implements MigrationInterface {
    name = 'UserUpdate1727185215331'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "user_sub" character varying`);
        await queryRunner.query(`CREATE INDEX "IDX_9a6b9deeed47e75ef82abe38bc" ON "user" ("user_sub") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_9a6b9deeed47e75ef82abe38bc"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "user_sub"`);
    }

}
