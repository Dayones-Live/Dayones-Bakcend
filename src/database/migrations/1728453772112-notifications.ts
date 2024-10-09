import { MigrationInterface, QueryRunner } from "typeorm";

export class Notifications1728453772112 implements MigrationInterface {
    name = 'Notifications1728453772112'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum" AS ENUM('reaction', 'comments', 'invite', 'message')`);
        await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "from_id" uuid NOT NULL, "to_id" uuid NOT NULL, "title" character varying NOT NULL, "message" character varying NOT NULL, "data" character varying NOT NULL, "is_read" boolean NOT NULL, "type" "public"."notifications_type_enum" NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_6a72c3c0f683f6462415e653c3a" UNIQUE ("id"), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d0c3d67c5f2512ceeaacf469aa" ON "notifications" ("from_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_fbdd526824994cbcee351f4a47" ON "notifications" ("to_id") `);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_d0c3d67c5f2512ceeaacf469aac" FOREIGN KEY ("from_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_fbdd526824994cbcee351f4a47e" FOREIGN KEY ("to_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_fbdd526824994cbcee351f4a47e"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_d0c3d67c5f2512ceeaacf469aac"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fbdd526824994cbcee351f4a47"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d0c3d67c5f2512ceeaacf469aa"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    }

}
