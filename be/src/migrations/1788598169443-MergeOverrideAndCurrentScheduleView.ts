import { MigrationInterface, QueryRunner } from 'typeorm';

export class MergeOverrideAndCurrentScheduleView1788598169443 implements MigrationInterface {
  name = 'MergeOverrideAndCurrentScheduleView1788598169443';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "merge_override" ("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "action" text NOT NULL, "item_id" bigint, "other_item_id" bigint, "mention_id" bigint, "note" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_merge_override_action" CHECK ("action" IN ('merge', 'unmerge', 'ignore_mention')), CONSTRAINT "PK_2119425884eb86d5ff47f60b816" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "merge_override" ADD CONSTRAINT "FK_421f57b115136096ad5fb18d3e8" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "merge_override" ADD CONSTRAINT "FK_18688aadd67af66e1d3958fc132" FOREIGN KEY ("other_item_id") REFERENCES "item"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "merge_override" ADD CONSTRAINT "FK_3c986c4e538310a6f38d1336921" FOREIGN KEY ("mention_id") REFERENCES "mention"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`CREATE VIEW "item_current_schedule" AS 
    SELECT "item_id", "kind", "scheduled_on", "scheduled_text", "undecided", "observed_at"
      FROM "scheduled_event"
     WHERE "superseded_at" IS NULL
  `);
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        'public',
        'VIEW',
        'item_current_schedule',
        'SELECT "item_id", "kind", "scheduled_on", "scheduled_text", "undecided", "observed_at"\n      FROM "scheduled_event"\n     WHERE "superseded_at" IS NULL',
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['VIEW', 'item_current_schedule', 'public'],
    );
    await queryRunner.query(`DROP VIEW "item_current_schedule"`);
    await queryRunner.query(
      `ALTER TABLE "merge_override" DROP CONSTRAINT "FK_3c986c4e538310a6f38d1336921"`,
    );
    await queryRunner.query(
      `ALTER TABLE "merge_override" DROP CONSTRAINT "FK_18688aadd67af66e1d3958fc132"`,
    );
    await queryRunner.query(
      `ALTER TABLE "merge_override" DROP CONSTRAINT "FK_421f57b115136096ad5fb18d3e8"`,
    );
    await queryRunner.query(`DROP TABLE "merge_override"`);
  }
}
