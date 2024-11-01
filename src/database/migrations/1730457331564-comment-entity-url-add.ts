import { MigrationInterface, QueryRunner } from "typeorm";

export class CommentEntityUrlAdd1730457331564 implements MigrationInterface {
    name = 'CommentEntityUrlAdd1730457331564'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comments" ADD "url" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comments" DROP COLUMN "url"`);
    }

}
