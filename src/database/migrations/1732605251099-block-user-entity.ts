import { MigrationInterface, QueryRunner } from "typeorm";

export class BlockUserEntity1732605251099 implements MigrationInterface {
    name = 'BlockUserEntity1732605251099'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "blocks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "blocked_by" uuid NOT NULL, "blocked_user" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_8244fa1495c4e9222a01059244b" UNIQUE ("id"), CONSTRAINT "PK_8244fa1495c4e9222a01059244b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_82ffa467047e5d8d4f7f7cb56a" ON "blocks" ("blocked_by") `);
        await queryRunner.query(`CREATE INDEX "IDX_a0fafa3f5e25ac363f9d6710ab" ON "blocks" ("blocked_user") `);
        await queryRunner.query(`ALTER TABLE "blocks" ADD CONSTRAINT "FK_82ffa467047e5d8d4f7f7cb56a7" FOREIGN KEY ("blocked_by") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "blocks" ADD CONSTRAINT "FK_a0fafa3f5e25ac363f9d6710ab2" FOREIGN KEY ("blocked_user") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "blocks" DROP CONSTRAINT "FK_a0fafa3f5e25ac363f9d6710ab2"`);
        await queryRunner.query(`ALTER TABLE "blocks" DROP CONSTRAINT "FK_82ffa467047e5d8d4f7f7cb56a7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a0fafa3f5e25ac363f9d6710ab"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_82ffa467047e5d8d4f7f7cb56a"`);
        await queryRunner.query(`DROP TABLE "blocks"`);
    }

}
