import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReactionEntityUpdate1730370316117 implements MigrationInterface {
  name = 'ReactionEntityUpdate1730370316117';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reactions" ADD "react_by" uuid`);
    await queryRunner.query(
      `CREATE INDEX "IDX_fac543d469c8c9f78260e0e626" ON "reactions" ("react_by") `,
    );
    await queryRunner.query(
      `ALTER TABLE "reactions" ADD CONSTRAINT "FK_fac543d469c8c9f78260e0e6265" FOREIGN KEY ("react_by") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reactions" DROP CONSTRAINT "FK_fac543d469c8c9f78260e0e6265"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fac543d469c8c9f78260e0e626"`,
    );
    await queryRunner.query(`ALTER TABLE "reactions" DROP COLUMN "react_by"`);
  }
}
