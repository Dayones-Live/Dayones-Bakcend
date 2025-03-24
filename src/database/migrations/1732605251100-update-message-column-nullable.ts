import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateMessageColumnNullable1732605251100 implements MigrationInterface {
  name = 'UpdateMessageColumnNullable1732605251100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" ALTER COLUMN "last_message" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" ALTER COLUMN "last_message" SET NOT NULL`,
    );
  }
} 