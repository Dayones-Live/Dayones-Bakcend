import { MigrationInterface, QueryRunner } from "typeorm";

export class FeedbackEntity1732269306106 implements MigrationInterface {
    name = 'FeedbackEntity1732269306106'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "feedback" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "description" character varying, "rating" integer, "feedback_by" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_52f321543b88d9a64ed9ca2f2f" UNIQUE ("feedback_by"), CONSTRAINT "PK_8389f9e087a57689cd5be8b2b13" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_52f321543b88d9a64ed9ca2f2f" ON "feedback" ("feedback_by") `);
        await queryRunner.query(`ALTER TABLE "feedback" ADD CONSTRAINT "FK_52f321543b88d9a64ed9ca2f2fd" FOREIGN KEY ("feedback_by") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "feedback" DROP CONSTRAINT "FK_52f321543b88d9a64ed9ca2f2fd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_52f321543b88d9a64ed9ca2f2f"`);
        await queryRunner.query(`DROP TABLE "feedback"`);
    }

}
