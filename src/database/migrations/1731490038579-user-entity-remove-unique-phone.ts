import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserEntityRemoveUniquePhone1731490038579
  implements MigrationInterface
{
  name = 'UserEntityRemoveUniquePhone1731490038579';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove the unique constraint on phone_number column
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "UQ_01eea41349b6c9275aec646eee0"`,
    );

    // Drop the index associated with phone_number column
    await queryRunner.query(
      `DROP INDEX "public"."IDX_01eea41349b6c9275aec646eee"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add the unique constraint on phone_number column
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "UQ_01eea41349b6c9275aec646eee0" UNIQUE ("phone_number")`,
    );

    // Re-create the index on phone_number column
    await queryRunner.query(
      `CREATE INDEX "IDX_01eea41349b6c9275aec646eee" ON "user" ("phone_number")`,
    );
  }
}
