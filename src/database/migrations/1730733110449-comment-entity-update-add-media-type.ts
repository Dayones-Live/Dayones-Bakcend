import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommentEntityUpdateAddMediaType1730733110449
  implements MigrationInterface
{
  name = 'CommentEntityUpdateAddMediaType1730733110449';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "comments" ADD "mediaType" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "comments" DROP COLUMN "mediaType"`);
  }
}
