import { MigrationInterface, QueryRunner } from "typeorm";

export class CommentReaction1729766949021 implements MigrationInterface {
    name = 'CommentReaction1729766949021'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "comment_reactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "comment_id" uuid NOT NULL, "liked_by" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d10c03282d5280fe55f0bb67563" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dc714054fc62b698018fcb0ae3" ON "comment_reactions" ("comment_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_3270387d54f7852c40d3e611ab" ON "comment_reactions" ("liked_by") `);
        await queryRunner.query(`ALTER TABLE "comment_reactions" ADD CONSTRAINT "FK_dc714054fc62b698018fcb0ae37" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comment_reactions" ADD CONSTRAINT "FK_3270387d54f7852c40d3e611ab1" FOREIGN KEY ("liked_by") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comment_reactions" DROP CONSTRAINT "FK_3270387d54f7852c40d3e611ab1"`);
        await queryRunner.query(`ALTER TABLE "comment_reactions" DROP CONSTRAINT "FK_dc714054fc62b698018fcb0ae37"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3270387d54f7852c40d3e611ab"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dc714054fc62b698018fcb0ae3"`);
        await queryRunner.query(`DROP TABLE "comment_reactions"`);
    }

}
