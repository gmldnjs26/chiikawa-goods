import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `item.series` + `source.config.series_tags` (docs/db-schema.md §5.2, docs/source-mapping.md §6 · §9.3, #20).
 *
 * 시리즈는 브랜드가 아니고 묶음 키도 아니다 — 접힌 발표를 펼쳤을 때의 소제목이다.
 * 판정은 태그 리터럴 일치 하나라 룩업 테이블 없이 `config` 배열로 둔다. 배열 순서가 대표 순서다.
 * 목록은 2026-09-06 실측(chiikawamarket 705건)과 source-mapping §9.3의 후보다.
 * `chiikawamogumogu`는 시리즈 태그가 없어 넣지 않는다 — 없는 규칙은 비워 둔다.
 */
export class ItemSeries1788800000000 implements MigrationInterface {
  name = 'ItemSeries1788800000000';

  private readonly seriesTags = [
    '映画ちいかわ',
    'ちいかわパーク',
    '超まじかるちいかわ',
    'まじかるちいかわ',
    'ちいかわレストラン',
    'シーサーのおみやげやさん',
    'Chiikawa Baby',
    'Kiramekko',
    'チルチルちいかわ',
    'Go!HARAJUKU',
    'Go!IKEBUKURO',
    'パラレルワールド',
    'ちいかわ×サンリオキャラクターズ',
    'CONVERSE×ちいかわ',
  ];

  private readonly sources = ['chiikawamarket', 'nagano-market'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "item" ADD "series" text array NOT NULL DEFAULT '{}'`);
    await queryRunner.query(
      `UPDATE "source" SET "config" = "config" || jsonb_build_object('series_tags', $1::jsonb)
        WHERE "code" = ANY($2)`,
      [JSON.stringify(this.seriesTags), this.sources],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "source" SET "config" = "config" - 'series_tags' WHERE "code" = ANY($1)`,
      [this.sources],
    );
    await queryRunner.query(`ALTER TABLE "item" DROP COLUMN "series"`);
  }
}
