import { MigrationInterface, QueryRunner } from "typeorm";

export class User1727091029022 implements MigrationInterface {
    name = 'User1727091029022'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."user_role_enum" AS ENUM('ADMIN', 'USER', 'ARTIST')`);
        await queryRunner.query(`CREATE TABLE "user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "full_name" character varying NOT NULL, "email" character varying, "phone_number" character varying, "is_confirmed" boolean, "role" "public"."user_role_enum" array NOT NULL DEFAULT '{USER}', CONSTRAINT "UQ_01eea41349b6c9275aec646eee0" UNIQUE ("phone_number"), CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_65e29b09a064487efd3e96c468" ON "user" ("full_name") `);
        await queryRunner.query(`CREATE INDEX "IDX_01eea41349b6c9275aec646eee" ON "user" ("phone_number") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_01eea41349b6c9275aec646eee"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_65e29b09a064487efd3e96c468"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`DROP TYPE "public"."user_role_enum"`);
    }

}
