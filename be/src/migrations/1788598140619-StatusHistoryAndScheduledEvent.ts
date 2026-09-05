import { MigrationInterface, QueryRunner } from 'typeorm';

export class StatusHistoryAndScheduledEvent1788598140619 implements MigrationInterface {
  name = 'StatusHistoryAndScheduledEvent1788598140619';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "scheduled_event" ("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "item_id" bigint NOT NULL, "kind" text NOT NULL, "scheduled_on" date, "scheduled_text" text, "undecided" boolean NOT NULL DEFAULT false, "observed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "mention_id" bigint, "superseded_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_scheduled_event_has_content" CHECK ("scheduled_on" IS NOT NULL OR "scheduled_text" IS NOT NULL OR "undecided"), CONSTRAINT "CHK_scheduled_event_kind" CHECK ("kind" IN ('preorder', 'release', 'restock')), CONSTRAINT "PK_59a1f1e0d902729bdfe3d02c089" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_be6c80cf6de5187e54aeb711d1" ON "scheduled_event"  ("scheduled_on") WHERE "superseded_at" IS NULL AND "scheduled_on" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_aa2152244685f51afffde34c7b" ON "scheduled_event"  ("item_id", "kind", "observed_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "status_history" ("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "item_id" bigint NOT NULL, "status" text NOT NULL, "observed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "mention_id" bigint, "is_backfilled" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_status_history_status" CHECK ("status" IN ('UPCOMING', 'ON_SALE', 'ENDED')), CONSTRAINT "PK_271a5228edb4eeb41bc01d58fac" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_status_history_backfill" ON "status_history"  ("item_id", "observed_at") WHERE "is_backfilled" = true`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_status_history_observation" ON "status_history"  ("item_id", "mention_id") WHERE "is_backfilled" = false`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fac5fce6e78ceff5ec49e170b0" ON "status_history"  ("item_id", "observed_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "scheduled_event" ADD CONSTRAINT "FK_96905f56907bd69b10a642c2061" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "scheduled_event" ADD CONSTRAINT "FK_b6060375a96dc26f1cdd2342185" FOREIGN KEY ("mention_id") REFERENCES "mention"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "status_history" ADD CONSTRAINT "FK_13a507473ec25613d8e13e70250" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "status_history" ADD CONSTRAINT "FK_477fd048df1cd293f9e8bed8ad8" FOREIGN KEY ("mention_id") REFERENCES "mention"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "status_history" DROP CONSTRAINT "FK_477fd048df1cd293f9e8bed8ad8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "status_history" DROP CONSTRAINT "FK_13a507473ec25613d8e13e70250"`,
    );
    await queryRunner.query(
      `ALTER TABLE "scheduled_event" DROP CONSTRAINT "FK_b6060375a96dc26f1cdd2342185"`,
    );
    await queryRunner.query(
      `ALTER TABLE "scheduled_event" DROP CONSTRAINT "FK_96905f56907bd69b10a642c2061"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_fac5fce6e78ceff5ec49e170b0"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_status_history_observation"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_status_history_backfill"`);
    await queryRunner.query(`DROP TABLE "status_history"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_aa2152244685f51afffde34c7b"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_be6c80cf6de5187e54aeb711d1"`);
    await queryRunner.query(`DROP TABLE "scheduled_event"`);
  }
}
