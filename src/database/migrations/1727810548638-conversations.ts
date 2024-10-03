import { MigrationInterface, QueryRunner } from 'typeorm';

export class Conversations1727810548638 implements MigrationInterface {
  name = 'Conversations1727810548638';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sender_id" uuid NOT NULL, "reciever_id" uuid NOT NULL, "last_message" character varying NOT NULL, "sender_reciever_code" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_ee34f4f7ced4ec8681f26bf04ef" UNIQUE ("id"), CONSTRAINT "PK_ee34f4f7ced4ec8681f26bf04ef" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e3c404a3d131a6e14028623bb7" ON "conversations" ("sender_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_37571da28d43f8e9aff6333723" ON "conversations" ("reciever_id") `,
    );

    await queryRunner.query(
      `ALTER TABLE "conversations" ADD CONSTRAINT "FK_e3c404a3d131a6e14028623bb76" FOREIGN KEY ("sender_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD CONSTRAINT "FK_37571da28d43f8e9aff63337233" FOREIGN KEY ("reciever_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP CONSTRAINT "FK_37571da28d43f8e9aff63337233"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP CONSTRAINT "FK_e3c404a3d131a6e14028623bb76"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_37571da28d43f8e9aff6333723"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e3c404a3d131a6e14028623bb7"`,
    );
    await queryRunner.query(`DROP TABLE "conversations"`);
  }
}
