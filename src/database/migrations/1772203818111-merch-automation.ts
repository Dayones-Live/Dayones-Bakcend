import { MigrationInterface, QueryRunner } from "typeorm";

export class MerchAutomation1772203818111 implements MigrationInterface {
    name = 'MerchAutomation1772203818111'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."merch_drops_status_enum" AS ENUM('CREATING', 'ACTIVE', 'EXPIRED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TYPE "public"."merch_products_product_type_enum" AS ENUM('TSHIRT', 'HOODIE', 'TANK', 'POSTER', 'HAT')`);
        await queryRunner.query(`CREATE TYPE "public"."merch_orders_status_enum" AS ENUM('PENDING', 'PAID', 'PRODUCTION', 'SHIPPED', 'DELIVERED', 'REFUNDED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TYPE "public"."order_ledger_status_enum" AS ENUM('PENDING', 'CALCULATED', 'PAID_OUT', 'REVERSED')`);
        await queryRunner.query(`CREATE TYPE "public"."payout_batches_status_enum" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')`);

        await queryRunner.query(`CREATE TABLE "stripe_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "stripe_account_id" character varying NOT NULL, "onboarding_complete" boolean NOT NULL DEFAULT false, "payouts_enabled" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_stripe_accounts_user_id" UNIQUE ("user_id"), CONSTRAINT "PK_stripe_accounts" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_stripe_accounts_user_id" ON "stripe_accounts" ("user_id")`);

        await queryRunner.query(`CREATE TABLE "merch_drops" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "artist_post_id" uuid NOT NULL, "artist_id" uuid NOT NULL, "status" "public"."merch_drops_status_enum" NOT NULL DEFAULT 'CREATING', "expires_at" TIMESTAMP NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_merch_drops_artist_post_id" UNIQUE ("artist_post_id"), CONSTRAINT "PK_merch_drops" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_merch_drops_artist_post_id" ON "merch_drops" ("artist_post_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_merch_drops_artist_id" ON "merch_drops" ("artist_id")`);

        await queryRunner.query(`CREATE TABLE "merch_products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "merch_drop_id" uuid NOT NULL, "printful_product_id" bigint, "printful_variant_id" bigint, "product_type" "public"."merch_products_product_type_enum" NOT NULL, "retail_price" numeric(10,2) NOT NULL, "image_url" character varying, "mockup_url" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_merch_products" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_merch_products_merch_drop_id" ON "merch_products" ("merch_drop_id")`);

        await queryRunner.query(`CREATE TABLE "merch_orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_number" character varying NOT NULL, "merch_drop_id" uuid NOT NULL, "fan_id" uuid NOT NULL, "artist_id" uuid NOT NULL, "stripe_payment_intent_id" character varying, "printful_order_id" bigint, "status" "public"."merch_orders_status_enum" NOT NULL DEFAULT 'PENDING', "subtotal" numeric(10,2) NOT NULL, "shipping_cost" numeric(10,2) NOT NULL DEFAULT '0', "total" numeric(10,2) NOT NULL, "shipping_address" jsonb, "tracking_number" character varying, "tracking_url" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_merch_orders_order_number" UNIQUE ("order_number"), CONSTRAINT "PK_merch_orders" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_merch_orders_merch_drop_id" ON "merch_orders" ("merch_drop_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_merch_orders_fan_id" ON "merch_orders" ("fan_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_merch_orders_artist_id" ON "merch_orders" ("artist_id")`);

        await queryRunner.query(`CREATE TABLE "merch_order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "merch_order_id" uuid NOT NULL, "merch_product_id" uuid NOT NULL, "quantity" integer NOT NULL DEFAULT '1', "unit_price" numeric(10,2) NOT NULL, "printful_cost" numeric(10,2), "size" character varying, "color" character varying, CONSTRAINT "PK_merch_order_items" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_merch_order_items_merch_order_id" ON "merch_order_items" ("merch_order_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_merch_order_items_merch_product_id" ON "merch_order_items" ("merch_product_id")`);

        await queryRunner.query(`CREATE TABLE "order_ledger" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "merch_order_id" uuid NOT NULL, "gross_revenue" numeric(10,2) NOT NULL DEFAULT '0', "stripe_fee" numeric(10,2) NOT NULL DEFAULT '0', "printful_cost" numeric(10,2) NOT NULL DEFAULT '0', "net_profit" numeric(10,2) NOT NULL DEFAULT '0', "artist_share" numeric(10,2) NOT NULL DEFAULT '0', "platform_share" numeric(10,2) NOT NULL DEFAULT '0', "status" "public"."order_ledger_status_enum" NOT NULL DEFAULT 'PENDING', "payout_batch_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_order_ledger_merch_order_id" UNIQUE ("merch_order_id"), CONSTRAINT "PK_order_ledger" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_order_ledger_merch_order_id" ON "order_ledger" ("merch_order_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_order_ledger_payout_batch_id" ON "order_ledger" ("payout_batch_id")`);

        await queryRunner.query(`CREATE TABLE "payout_batches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "artist_id" uuid NOT NULL, "stripe_transfer_id" character varying, "total_amount" numeric(10,2) NOT NULL, "order_count" integer NOT NULL, "period_start" date NOT NULL, "period_end" date NOT NULL, "status" "public"."payout_batches_status_enum" NOT NULL DEFAULT 'PENDING', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_payout_batches" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_payout_batches_artist_id" ON "payout_batches" ("artist_id")`);

        await queryRunner.query(`ALTER TABLE "stripe_accounts" ADD CONSTRAINT "FK_stripe_accounts_user_id" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "merch_drops" ADD CONSTRAINT "FK_merch_drops_artist_post_id" FOREIGN KEY ("artist_post_id") REFERENCES "artist_post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "merch_drops" ADD CONSTRAINT "FK_merch_drops_artist_id" FOREIGN KEY ("artist_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "merch_products" ADD CONSTRAINT "FK_merch_products_merch_drop_id" FOREIGN KEY ("merch_drop_id") REFERENCES "merch_drops"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "merch_orders" ADD CONSTRAINT "FK_merch_orders_merch_drop_id" FOREIGN KEY ("merch_drop_id") REFERENCES "merch_drops"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "merch_orders" ADD CONSTRAINT "FK_merch_orders_fan_id" FOREIGN KEY ("fan_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "merch_orders" ADD CONSTRAINT "FK_merch_orders_artist_id" FOREIGN KEY ("artist_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "merch_order_items" ADD CONSTRAINT "FK_merch_order_items_merch_order_id" FOREIGN KEY ("merch_order_id") REFERENCES "merch_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "merch_order_items" ADD CONSTRAINT "FK_merch_order_items_merch_product_id" FOREIGN KEY ("merch_product_id") REFERENCES "merch_products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_ledger" ADD CONSTRAINT "FK_order_ledger_merch_order_id" FOREIGN KEY ("merch_order_id") REFERENCES "merch_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_ledger" ADD CONSTRAINT "FK_order_ledger_payout_batch_id" FOREIGN KEY ("payout_batch_id") REFERENCES "payout_batches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payout_batches" ADD CONSTRAINT "FK_payout_batches_artist_id" FOREIGN KEY ("artist_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payout_batches" DROP CONSTRAINT "FK_payout_batches_artist_id"`);
        await queryRunner.query(`ALTER TABLE "order_ledger" DROP CONSTRAINT "FK_order_ledger_payout_batch_id"`);
        await queryRunner.query(`ALTER TABLE "order_ledger" DROP CONSTRAINT "FK_order_ledger_merch_order_id"`);
        await queryRunner.query(`ALTER TABLE "merch_order_items" DROP CONSTRAINT "FK_merch_order_items_merch_product_id"`);
        await queryRunner.query(`ALTER TABLE "merch_order_items" DROP CONSTRAINT "FK_merch_order_items_merch_order_id"`);
        await queryRunner.query(`ALTER TABLE "merch_orders" DROP CONSTRAINT "FK_merch_orders_artist_id"`);
        await queryRunner.query(`ALTER TABLE "merch_orders" DROP CONSTRAINT "FK_merch_orders_fan_id"`);
        await queryRunner.query(`ALTER TABLE "merch_orders" DROP CONSTRAINT "FK_merch_orders_merch_drop_id"`);
        await queryRunner.query(`ALTER TABLE "merch_products" DROP CONSTRAINT "FK_merch_products_merch_drop_id"`);
        await queryRunner.query(`ALTER TABLE "merch_drops" DROP CONSTRAINT "FK_merch_drops_artist_id"`);
        await queryRunner.query(`ALTER TABLE "merch_drops" DROP CONSTRAINT "FK_merch_drops_artist_post_id"`);
        await queryRunner.query(`ALTER TABLE "stripe_accounts" DROP CONSTRAINT "FK_stripe_accounts_user_id"`);

        await queryRunner.query(`DROP INDEX "public"."IDX_payout_batches_artist_id"`);
        await queryRunner.query(`DROP TABLE "payout_batches"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_order_ledger_payout_batch_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_order_ledger_merch_order_id"`);
        await queryRunner.query(`DROP TABLE "order_ledger"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_merch_order_items_merch_product_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_merch_order_items_merch_order_id"`);
        await queryRunner.query(`DROP TABLE "merch_order_items"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_merch_orders_artist_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_merch_orders_fan_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_merch_orders_merch_drop_id"`);
        await queryRunner.query(`DROP TABLE "merch_orders"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_merch_products_merch_drop_id"`);
        await queryRunner.query(`DROP TABLE "merch_products"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_merch_drops_artist_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_merch_drops_artist_post_id"`);
        await queryRunner.query(`DROP TABLE "merch_drops"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_stripe_accounts_user_id"`);
        await queryRunner.query(`DROP TABLE "stripe_accounts"`);

        await queryRunner.query(`DROP TYPE "public"."payout_batches_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."order_ledger_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."merch_orders_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."merch_products_product_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."merch_drops_status_enum"`);
    }
}
