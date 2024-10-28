import { MigrationInterface, QueryRunner } from "typeorm";

export class CommentsEntityUpdateField1730102237142 implements MigrationInterface {
    name = 'CommentsEntityUpdateField1730102237142'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comments" ADD "comment_by" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_582b270511e78df05b312d171e" ON "comments" ("comment_by") `);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_582b270511e78df05b312d171ea" FOREIGN KEY ("comment_by") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_582b270511e78df05b312d171ea"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_582b270511e78df05b312d171e"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP COLUMN "comment_by"`);
    }

}