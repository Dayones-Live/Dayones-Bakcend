import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateNotificationsTypeEnumAddMessage1716923892000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE notifications_type_enum ADD VALUE IF NOT EXISTS 'MESSAGE';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL doesn't support removing values from enums
    // We would need to create a new enum and replace the old one
    // This is a complex operation and might require data migration
    // For now, we'll leave this empty
  }
} 