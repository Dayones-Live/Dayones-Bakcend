import { MigrationInterface, QueryRunner } from "typeorm";

export class ReportEntity1732254843620 implements MigrationInterface {
    name = 'ReportEntity1732254843620'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "report" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "description" character varying, "reported_by" uuid NOT NULL, "reported_user_id" uuid, "reported_post_id" uuid, "reported_comment_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_99e4d0bea58cba73c57f935a546" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f7c6fdd1bc00dac6d75c070c9e" ON "report" ("reported_by") `);
        await queryRunner.query(`CREATE INDEX "IDX_798954c041abe4b92a8f47d663" ON "report" ("reported_user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ce2683e90f48c26906d83b4f22" ON "report" ("reported_post_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_12f75e00919ec73fa05c398677" ON "report" ("reported_comment_id") `);
        await queryRunner.query(`ALTER TABLE "report" ADD CONSTRAINT "FK_f7c6fdd1bc00dac6d75c070c9ec" FOREIGN KEY ("reported_by") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "report" ADD CONSTRAINT "FK_798954c041abe4b92a8f47d6638" FOREIGN KEY ("reported_user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "report" ADD CONSTRAINT "FK_ce2683e90f48c26906d83b4f222" FOREIGN KEY ("reported_post_id") REFERENCES "artist_post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "report" ADD CONSTRAINT "FK_12f75e00919ec73fa05c3986773" FOREIGN KEY ("reported_comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "report" DROP CONSTRAINT "FK_12f75e00919ec73fa05c3986773"`);
        await queryRunner.query(`ALTER TABLE "report" DROP CONSTRAINT "FK_ce2683e90f48c26906d83b4f222"`);
        await queryRunner.query(`ALTER TABLE "report" DROP CONSTRAINT "FK_798954c041abe4b92a8f47d6638"`);
        await queryRunner.query(`ALTER TABLE "report" DROP CONSTRAINT "FK_f7c6fdd1bc00dac6d75c070c9ec"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_12f75e00919ec73fa05c398677"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ce2683e90f48c26906d83b4f22"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_798954c041abe4b92a8f47d663"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f7c6fdd1bc00dac6d75c070c9e"`);
        await queryRunner.query(`DROP TABLE "report"`);
    }

}
