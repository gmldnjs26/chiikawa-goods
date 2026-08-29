import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tier 0 첫 소스 (docs/data-collection-design.md §5, docs/source-mapping.md §6).
 *
 * **소스 추가 = `source` 행 1개 + migration 1개. 코드 변경 없음.**
 * 태그 규칙·컬렉션 규칙이 전부 `config`에 있다 — 정규식을 코드에 두면 이 성질이 깨진다.
 */
export class SeedChiikawamarket1787654400000 implements MigrationInterface {
  name = 'SeedChiikawamarket1787654400000';

  private readonly config = {
    // `updated_at`은 요청마다 바뀐다. 빼지 않으면 폴링마다 전건이 새 행이 된다
    // (실측 근거: docs/source-mapping.md §1)
    hash_exclude: ['updated_at'],
    poll_collections: {
      always: ['newitems'],
      // 컬렉션 1006개를 매번 돌 수 없다 (docs/source-mapping.md §6.0)
      date_pattern: '^(?:pre|re|new-re)?(\\d{8})',
      recent_days: 14,
    },
    release_tag: '^(\\d{8})$',
    preorder_tag: '^PRE(\\d{8})$',
    restock_tag: '^RE(\\d{8})$',
    upcoming_tag: '販売開始前',
    tax_included: true,
    default_acquisition: 'fixed',
    default_region: 'online',
    supports_preorder_detection: true,
    supports_restock_backfill: true,
    label_tags_extra: ['海外NG', '数量制限', '1個/1会計', '2個/1会計'],
  };

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "source"
         ("code", "name", "kind", "platform", "fetch_kind", "config",
          "base_url", "channel", "interval_sec", "crawl_delay_sec", "silence_alert_sec")
       VALUES ($1, $2, 'official_store', 'shopify', 'json', $3::jsonb,
               $4, 'online_official', $5, $6, $7)`,
      [
        'chiikawamarket',
        'ちいかわマーケット',
        JSON.stringify(this.config),
        'https://chiikawamarket.jp',
        1800, // 30분
        3, // robots.txt에 Crawl-delay가 없다. 우리가 정한 값이다
        60 * 60 * 24 * 3, // 3일 조용하면 이상하다
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // mention이 이 소스를 참조하므로 지워지지 않는 것이 정상이다.
    // 되돌리려면 데이터를 먼저 정리해야 한다 — 하드 삭제는 규범 위반이다
    await queryRunner.query(`DELETE FROM "source" WHERE "code" = $1`, ['chiikawamarket']);
  }
}
