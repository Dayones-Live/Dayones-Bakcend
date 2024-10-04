import { MigrationInterface, QueryRunner } from 'typeorm';

export class Messages1727971629302 implements MigrationInterface {
  name = 'Messages1727971629302';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sender_id" uuid NOT NULL, "conversation_id" uuid NOT NULL, "message" character varying NOT NULL, "url" character varying, "is_read" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_18325f38ae6de43878487eff986" UNIQUE ("id"), CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_22133395bd13b970ccd0c34ab2" ON "messages" ("sender_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3bc55a7c3f9ed54b520bb5cfe2" ON "messages" ("conversation_id") `,
    );

    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_22133395bd13b970ccd0c34ab22" FOREIGN KEY ("sender_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_3bc55a7c3f9ed54b520bb5cfe23" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_3bc55a7c3f9ed54b520bb5cfe23"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_22133395bd13b970ccd0c34ab22"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_3bc55a7c3f9ed54b520bb5cfe2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_22133395bd13b970ccd0c34ab2"`,
    );
    await queryRunner.query(`DROP TABLE "messages"`);
  }
}
