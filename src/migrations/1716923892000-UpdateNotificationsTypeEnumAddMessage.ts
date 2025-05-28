import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateNotificationsTypeEnumAddMessage1716923892000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'MESSAGE';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No easy way to remove a value from a Postgres enum
  }
} 