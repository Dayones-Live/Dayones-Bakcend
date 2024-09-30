import { MigrationInterface, QueryRunner } from "typeorm";

export class AddedTimestamp1727545186449 implements MigrationInterface {
    name = 'AddedTimestamp1727545186449'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user-notifications" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "user-notifications" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "signatures" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "signatures" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "artist_post" ADD CONSTRAINT "UQ_04ab30954ee3a34f1b873574bf1" UNIQUE ("id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "artist_post" DROP CONSTRAINT "UQ_04ab30954ee3a34f1b873574bf1"`);
        await queryRunner.query(`ALTER TABLE "signatures" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "signatures" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "user-notifications" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "user-notifications" DROP COLUMN "created_at"`);
    }

}
