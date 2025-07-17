import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateProfileTable1750000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'profile',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'bio',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'varchar',
            length: '1000',
            isNullable: true,
          },
          {
            name: 'website',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'instagram',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'twitter',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'facebook',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'tiktok',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'youtube',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'profile',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'user',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('profile');
    const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf('user_id') !== -1);
    await queryRunner.dropForeignKey('profile', foreignKey);
    await queryRunner.dropTable('profile');
  }
} 