import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateProfileGalleryTable1750000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'profile_gallery',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'image_url',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'caption',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          {
            name: 'alt_text',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'display_order',
            type: 'int',
            default: 0,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
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
      'profile_gallery',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'user',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('profile_gallery');
    const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf('user_id') !== -1);
    await queryRunner.dropForeignKey('profile_gallery', foreignKey);
    await queryRunner.dropTable('profile_gallery');
  }
} 