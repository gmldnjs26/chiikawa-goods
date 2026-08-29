import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tier 0 나머지 2소스 (docs/data-collection-design.md §5, docs/source-mapping.md §6).
 *
 * **이 migration에 코드 변경이 딸리지 않는 것이 어댑터 설계의 증명이다.**
 * 태그 형식도, 관련성 필터도, 미지원 판정도 전부 `config`가 흡수한다.
 */
export class SeedNaganoAndMogumogu1787654500000 implements MigrationInterface {
  name = 'SeedNaganoAndMogumogu1787654500000';

  /**
   * ちいかわ 전용 스토어가 아니다 — 나가노의 다른 작품이 같은 피드에 섞인다 (§7).
   * 재입고 태그는 8자리와 6자리가 **공존**한다 → 규칙이 배열이다.
   */
  private readonly nagano = {
    hash_exclude: ['updated_at'],
    poll_collections: {
      always: ['newitems'],
      date_pattern: '^(?:pre|re|new-re)?(\\d{8})',
      recent_days: 14,
    },
    release_tag: '^(\\d{8})$',
    preorder_tag: '^PRE(\\d{8})$',
    restock_tag: ['^RE(\\d{8})$', '^RE(\\d{6})$'],
    upcoming_tag: '販売開始前',
    tax_included: true,
    default_acquisition: 'fixed',
    default_region: 'online',
    supports_preorder_detection: true,
    supports_restock_backfill: true,
    relevance_filter: {
      include_tags: ['ちいかわ', 'ちいかわキャラクターズ'],
      include_collections: ['chiikawa', 'chiikawa-characters'],
      mixed_marker_tags: ['ナガノのくま', 'もぐらコロッケ', 'パグ', 'カエル', 'ギョニソ'],
    },
    label_tag_source: 'character_table',
    label_tags_extra: ['海外NG', '数量制限', '1個/1会計', '2個/1会計'],
    drop_tags: [
      '在庫有無確認用タグ',
      '破棄対象商品',
      '同梱不可',
      '同梱不可A',
      'ラッピング不可',
      'キャンペーン対象外',
      'グループ',
      '共通商品',
      '新商品',
    ],
  };

  /**
   * 예약·재입고 태그가 **존재하지 않는다** (상품 30건 태그 합집합에 하나도 없었다).
   * `null`로 두고 어댑터가 그 판정을 건너뛴다 — **추측으로 채우지 않는다.**
   * `supports_*`가 false인 이유는 무음 감지다. 지원하지 않는 소스에
   * "예약이 0건"이라는 경보를 내면 안 된다.
   *
   * `newitems` 컬렉션이 없고 날짜 컬렉션 형식도 확인되지 않아 `all`만 돈다.
   */
  private readonly mogumogu = {
    hash_exclude: ['updated_at'],
    poll_collections: { always: ['all'], date_pattern: null, recent_days: 14 },
    release_tag: '^(\\d{4})年(\\d{1,2})月(\\d{1,2})日発売商品$',
    preorder_tag: null,
    restock_tag: null,
    upcoming_tag: null,
    tax_included: true,
    default_acquisition: 'fixed',
    default_region: 'online',
    supports_preorder_detection: false,
    supports_restock_backfill: false,
    label_tags: ['川越', 'otaru', 'kyoto-fusimi', '古本屋'],
  };

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.insert(queryRunner, {
      code: 'nagano-market',
      name: 'ナガノマーケット',
      baseUrl: 'https://nagano-market.jp',
      config: this.nagano,
      disabledReason: '이용규약 판단 대기 — docs/source-mapping.md §6.2',
    });
    await this.insert(queryRunner, {
      code: 'chiikawamogumogu',
      name: 'ちいかわもぐもぐ本舗',
      baseUrl: 'https://chiikawamogumogu.shop',
      config: this.mogumogu,
      disabledReason: '이용규약 판단 대기(자동화 금지 조항은 없음) — docs/source-mapping.md §6.2',
    });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "source" WHERE "code" = ANY($1)`, [
      ['nagano-market', 'chiikawamogumogu'],
    ]);
  }

  /**
   * **둘 다 `enabled=false`다.** 사유는 소스마다 다르다 —
   * `nagano-market.jp`는 `chiikawamarket.jp`와 같은 규약 문면이라 같은 보류에 걸린다.
   * `chiikawamogumogu.shop`은 자동화 금지 조항이 **없지만** 같이 판단하기로 했다
   * (docs/source-mapping.md §6.2). 켜는 것은 사람의 결정이다.
   */
  private insert(
    queryRunner: QueryRunner,
    source: { code: string; name: string; baseUrl: string; config: object; disabledReason: string },
  ): Promise<unknown> {
    return queryRunner.query(
      `INSERT INTO "source"
         ("code", "name", "kind", "platform", "fetch_kind", "config",
          "base_url", "channel", "interval_sec", "crawl_delay_sec", "silence_alert_sec",
          "enabled", "disabled_reason")
       VALUES ($1, $2, 'official_store', 'shopify', 'json', $3::jsonb,
               $4, 'online_official', 1800, 3, $5, false, $6)`,
      [
        source.code,
        source.name,
        JSON.stringify(source.config),
        source.baseUrl,
        60 * 60 * 24 * 3,
        source.disabledReason,
      ],
    );
  }
}
