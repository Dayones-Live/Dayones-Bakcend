import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommentEntityUpdateAddReply1730661470357
  implements MigrationInterface
{
  name = 'CommentEntityUpdateAddReply1730661470357';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "comments" ADD "parent_comment_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_93ce08bdbea73c0c7ee673ec35a" FOREIGN KEY ("parent_comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_93ce08bdbea73c0c7ee673ec35a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP COLUMN "parent_comment_id"`,
    );
  }
}
