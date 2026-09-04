import { MigrationInterface, QueryRunner } from "typeorm";

export class ItemsAndDropGroups1788523465428 implements MigrationInterface {
    name = 'ItemsAndDropGroups1788523465428'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "drop_group" ("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "title" text NOT NULL, "kind" text NOT NULL, "primary_date" date, "grouping_key" text, "is_manual" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_a6ec1aa5649001ddc74685d1d18" UNIQUE ("grouping_key"), CONSTRAINT "CHK_drop_group_kind" CHECK ("kind" IN ('preorder', 'release', 'restock', 'campaign')), CONSTRAINT "PK_e4991d98b3632bfa450eebc4029" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8a4a4a20ca56b3da7c21cd673c" ON "drop_group"  ("primary_date") `);
        await queryRunner.query(`CREATE TABLE "item" ("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "drop_id" bigint, "brand_id" bigint, "title" text NOT NULL, "title_norm" text NOT NULL, "canonical_url" text, "official_url" text NOT NULL, "image_url" text, "price" integer, "price_varies" boolean NOT NULL DEFAULT false, "price_tax_included" boolean, "variant_available" integer, "variant_total" integer, "category" text, "vendor" text, "channel" text NOT NULL, "acquisition" text NOT NULL, "series_total" integer, "region" text NOT NULL DEFAULT 'online', "labels" text array NOT NULL DEFAULT '{}', "status" text NOT NULL, "status_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "preorder_on" date, "release_on" date, "time_estimated" boolean NOT NULL DEFAULT true, "available_until" date, "suppressed_at" TIMESTAMP WITH TIME ZONE, "suppressed_reason" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_36626b11e57d79a851fa59e200e" UNIQUE ("canonical_url"), CONSTRAINT "CHK_item_acquisition" CHECK ("acquisition" IN ('fixed', 'random')), CONSTRAINT "CHK_item_channel" CHECK ("channel" IN ('online_official', 'konbini', 'arcade', 'gacha', 'kuji', 'store', 'apparel')), CONSTRAINT "CHK_item_status" CHECK ("status" IN ('UPCOMING', 'ON_SALE', 'ENDED')), CONSTRAINT "CHK_item_store_region" CHECK ("channel" <> 'store' OR "region" <> 'online'), CONSTRAINT "CHK_item_random_total" CHECK ("acquisition" <> 'random' OR "series_total" IS NOT NULL), CONSTRAINT "PK_d3c0c71f23e7adcf952a1d13423" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7955b0a0fb65e4efa94ffde37c" ON "item" USING gin ("labels") `);
        await queryRunner.query(`CREATE INDEX "IDX_5167b074fc41056b860f23fc0d" ON "item"  ("title_norm") `);
        await queryRunner.query(`CREATE INDEX "IDX_82d1876e944ef515314bc5e104" ON "item"  ("brand_id") WHERE "suppressed_at" IS NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_44f8cc09e8d371c6d91c5d1963" ON "item"  ("channel") WHERE "suppressed_at" IS NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_0c84e90ffbdc8d4d80133cbd2a" ON "item"  ("status", "release_on") WHERE "suppressed_at" IS NULL`);
        await queryRunner.query(`CREATE TABLE "item_mention" ("item_id" bigint NOT NULL, "mention_id" bigint NOT NULL, "role" text NOT NULL DEFAULT 'evidence', "linked_by" text NOT NULL DEFAULT 'auto', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_item_mention_linked_by" CHECK ("linked_by" IN ('auto', 'manual')), CONSTRAINT "CHK_item_mention_role" CHECK ("role" IN ('primary', 'evidence')), CONSTRAINT "PK_5830465bb1c49727fbe0b99e3c2" PRIMARY KEY ("item_id", "mention_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_16fea25fcd93ee09867f8d4761" ON "item_mention"  ("mention_id") `);
        await queryRunner.query(`ALTER TABLE "item" ADD CONSTRAINT "FK_b1f3d2711613629dcf1cd95d4f9" FOREIGN KEY ("drop_id") REFERENCES "drop_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "item" ADD CONSTRAINT "FK_38b2bdc06bbb58f27ee37a7ddbc" FOREIGN KEY ("brand_id") REFERENCES "brand"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "item_mention" ADD CONSTRAINT "FK_54a23d32b8ab611940cecfd2fb4" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "item_mention" ADD CONSTRAINT "FK_16fea25fcd93ee09867f8d4761d" FOREIGN KEY ("mention_id") REFERENCES "mention"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item_mention" DROP CONSTRAINT "FK_16fea25fcd93ee09867f8d4761d"`);
        await queryRunner.query(`ALTER TABLE "item_mention" DROP CONSTRAINT "FK_54a23d32b8ab611940cecfd2fb4"`);
        await queryRunner.query(`ALTER TABLE "item" DROP CONSTRAINT "FK_38b2bdc06bbb58f27ee37a7ddbc"`);
        await queryRunner.query(`ALTER TABLE "item" DROP CONSTRAINT "FK_b1f3d2711613629dcf1cd95d4f9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_16fea25fcd93ee09867f8d4761"`);
        await queryRunner.query(`DROP TABLE "item_mention"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0c84e90ffbdc8d4d80133cbd2a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_44f8cc09e8d371c6d91c5d1963"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_82d1876e944ef515314bc5e104"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5167b074fc41056b860f23fc0d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7955b0a0fb65e4efa94ffde37c"`);
        await queryRunner.query(`DROP TABLE "item"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8a4a4a20ca56b3da7c21cd673c"`);
        await queryRunner.query(`DROP TABLE "drop_group"`);
    }

}
