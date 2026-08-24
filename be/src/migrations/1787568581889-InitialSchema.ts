import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1787568581889 implements MigrationInterface {
    name = 'InitialSchema1787568581889'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "brand" ("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "code" text NOT NULL, "label_ja" text NOT NULL, "match_rules" jsonb, "sort_order" integer NOT NULL DEFAULT '100', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_40218d8d4bbf8e38d458869a1c5" UNIQUE ("code"), CONSTRAINT "PK_a5d20765ddd942eb5de4eee2d7f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "source" ("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "code" text NOT NULL, "name" text NOT NULL, "kind" text NOT NULL, "platform" text NOT NULL, "fetch_kind" text NOT NULL, "config" jsonb NOT NULL DEFAULT '{}', "base_url" text NOT NULL, "channel" text NOT NULL, "interval_sec" integer NOT NULL, "crawl_delay_sec" integer NOT NULL DEFAULT '0', "enabled" boolean NOT NULL DEFAULT true, "disabled_reason" text, "silence_alert_sec" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_0c4fa34ab948d93a78795a5301c" UNIQUE ("code"), CONSTRAINT "CHK_source_fetch_kind" CHECK ("fetch_kind" IN ('json', 'rss', 'atom', 'html', 'sitemap')), CONSTRAINT "CHK_source_kind" CHECK ("kind" IN ('official_store', 'fan_blog', 'press', 'konbini', 'prize', 'gacha', 'apparel', 'retail')), CONSTRAINT "PK_018c433f8264b58c86363eaadde" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "collection_run" ("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "source_id" bigint NOT NULL, "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "finished_at" TIMESTAMP WITH TIME ZONE, "status" text NOT NULL, "mention_count" integer NOT NULL DEFAULT '0', "new_count" integer NOT NULL DEFAULT '0', "excluded_count" integer NOT NULL DEFAULT '0', "http_status" integer, "failure_kind" text, "error_message" text, CONSTRAINT "CHK_collection_run_failure_kind" CHECK ("failure_kind" IS NULL OR "failure_kind" IN ('network', 'http', 'validation', 'parse', 'blocked')), CONSTRAINT "CHK_collection_run_status" CHECK ("status" IN ('running', 'success', 'failed', 'skipped_locked', 'skipped_idle')), CONSTRAINT "PK_cf3471a5bb865d5c2087a194eea" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_66be74fe441614661ee155aac9" ON "collection_run"  ("source_id", "started_at") `);
        await queryRunner.query(`CREATE TABLE "mention" ("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "source_id" bigint NOT NULL, "collection_run_id" bigint, "external_id" text NOT NULL, "url" text NOT NULL, "raw_title" text NOT NULL, "raw_payload" jsonb, "payload_hash" text NOT NULL, "payload_purged_at" TIMESTAMP WITH TIME ZONE, "relevance" text NOT NULL DEFAULT 'included', "observed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_29e81fdcbc6e10e92f186bd8751" UNIQUE ("source_id", "external_id", "payload_hash"), CONSTRAINT "CHK_mention_relevance" CHECK ("relevance" IN ('included', 'mixed', 'excluded')), CONSTRAINT "PK_9b02b76c4b65e3c35c1a545bf57" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9ac42a547a2a09d2587533e5b6" ON "mention"  ("observed_at") WHERE "raw_payload" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_18f77f0565dd32606ceb145d92" ON "mention"  ("source_id", "observed_at") `);
        await queryRunner.query(`ALTER TABLE "collection_run" ADD CONSTRAINT "FK_1c77b956902008f593a201fd9db" FOREIGN KEY ("source_id") REFERENCES "source"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "mention" ADD CONSTRAINT "FK_09782839840b3a98b947fed74c2" FOREIGN KEY ("source_id") REFERENCES "source"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "mention" ADD CONSTRAINT "FK_6f95f2e01d35fc3f4e6ff0e3432" FOREIGN KEY ("collection_run_id") REFERENCES "collection_run"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mention" DROP CONSTRAINT "FK_6f95f2e01d35fc3f4e6ff0e3432"`);
        await queryRunner.query(`ALTER TABLE "mention" DROP CONSTRAINT "FK_09782839840b3a98b947fed74c2"`);
        await queryRunner.query(`ALTER TABLE "collection_run" DROP CONSTRAINT "FK_1c77b956902008f593a201fd9db"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_18f77f0565dd32606ceb145d92"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9ac42a547a2a09d2587533e5b6"`);
        await queryRunner.query(`DROP TABLE "mention"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_66be74fe441614661ee155aac9"`);
        await queryRunner.query(`DROP TABLE "collection_run"`);
        await queryRunner.query(`DROP TABLE "source"`);
        await queryRunner.query(`DROP TABLE "brand"`);
    }

}
