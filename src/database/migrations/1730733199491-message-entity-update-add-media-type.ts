import { MigrationInterface, QueryRunner } from 'typeorm';

export class MessageEntityUpdateAddMediaType1730733199491
  implements MigrationInterface
{
  name = 'MessageEntityUpdateAddMediaType1730733199491';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "messages" ADD "media_type" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "media_type"`);
  }
}
