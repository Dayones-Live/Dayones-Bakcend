import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAgeBracketToUser1787200000000 implements MigrationInterface {
  name = 'AddAgeBracketToUser1787200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_age_bracket_enum') THEN
          CREATE TYPE "user_age_bracket_enum" AS ENUM ('UNDER_13', 'AGE_13_17', 'AGE_18_PLUS');
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS "age_bracket" "user_age_bracket_enum"
    `);
    await queryRunner.query(`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS "age_blocked" BOOLEAN NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_age_bracket" ON "user" ("age_bracket")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_age_blocked" ON "user" ("age_blocked")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_age_blocked"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_age_bracket"`);
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "age_blocked"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "age_bracket"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "user_age_bracket_enum"`);
  }
}
