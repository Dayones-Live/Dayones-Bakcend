import { MigrationInterface, QueryRunner } from "typeorm";

export class MerchProductVariants1772290000000 implements MigrationInterface {
    name = 'MerchProductVariants1772290000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "merch_products" ADD "size" character varying`);
        await queryRunner.query(`ALTER TABLE "merch_products" ADD "color" character varying`);
        await queryRunner.query(`ALTER TABLE "merch_products" ADD "color_code" character varying`);
        await queryRunner.query(`ALTER TABLE "merch_products" ADD "printful_catalog_product_id" integer`);

        await queryRunner.query(`ALTER TYPE "public"."merch_orders_status_enum" ADD VALUE IF NOT EXISTS 'RETURN_REQUESTED'`);
        await queryRunner.query(`ALTER TYPE "public"."merch_orders_status_enum" ADD VALUE IF NOT EXISTS 'RETURN_APPROVED'`);
        await queryRunner.query(`ALTER TYPE "public"."merch_orders_status_enum" ADD VALUE IF NOT EXISTS 'RETURN_DENIED'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "merch_products" DROP COLUMN "printful_catalog_product_id"`);
        await queryRunner.query(`ALTER TABLE "merch_products" DROP COLUMN "color_code"`);
        await queryRunner.query(`ALTER TABLE "merch_products" DROP COLUMN "color"`);
        await queryRunner.query(`ALTER TABLE "merch_products" DROP COLUMN "size"`);
    }
}
