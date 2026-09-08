import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 브랜드 초기 목록 (docs/plan.md §6.6 · docs/db-schema.md §5.1 · docs/source-mapping.md §4).
 *
 * **브랜드는 스토어 브랜드다** — ちいかわマーケット · ナガノマーケット · ちいかわポケット ·
 * もぐもぐ本舗 · 一番くじ. 유저가 「무슨 종류인가」로 읽는 이름표이고, 필터 칩의 후보다.
 * `映画ちいかわ` `ちいかわパーク` 같은 시리즈는 브랜드가 아니라 `labels`다 — 한 발표(컬렉션)
 * 안에 여러 시리즈가 섞이므로 시리즈로 나누면 발표 단위 묶음(§6)이 갈라진다.
 *
 * 실측 (2026-09-06, chiikawamarket 705건 · mogumogu 606건): 상품 태그·컬렉션·제목 어디에도
 * 스토어명이 없다. 그래서 규칙은 `sources`(소스 코드) 하나다 — 그 스토어의 상품이라는 사실이 근거다.
 * `pocket` · `ichiban_kuji`는 아직 소스가 없어 규칙을 비운다. 규칙 없는 브랜드는 판정되지 않는다.
 * 소스가 생기면 여기가 아니라 `match_rules` UPDATE로 채운다 — 그래서 코드가 아니라 DB다.
 */
export class SeedBrands1788700000000 implements MigrationInterface {
  name = 'SeedBrands1788700000000';

  private readonly brands: {
    code: string;
    labelJa: string;
    matchRules: Record<string, unknown> | null;
    sortOrder: number;
  }[] = [
    {
      code: 'chiikawa_market',
      labelJa: 'ちいかわマーケット',
      matchRules: { sources: ['chiikawamarket'] },
      sortOrder: 10,
    },
    {
      code: 'nagano_market',
      labelJa: 'ナガノマーケット',
      matchRules: { sources: ['nagano-market'] },
      sortOrder: 20,
    },
    { code: 'pocket', labelJa: 'ちいかわポケット', matchRules: null, sortOrder: 30 },
    {
      code: 'mogumogu',
      labelJa: 'ちいかわもぐもぐ本舗',
      matchRules: { sources: ['chiikawamogumogu'] },
      sortOrder: 40,
    },
    { code: 'ichiban_kuji', labelJa: '一番くじ', matchRules: null, sortOrder: 50 },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const brand of this.brands) {
      await queryRunner.query(
        `INSERT INTO "brand" ("code", "label_ja", "match_rules", "sort_order")
         VALUES ($1, $2, $3::jsonb, $4)`,
        [
          brand.code,
          brand.labelJa,
          brand.matchRules === null ? null : JSON.stringify(brand.matchRules),
          brand.sortOrder,
        ],
      );
    }
  }

  /**
   * 되돌리기 = 미판정 복귀. `item.brand_id`를 비우고, 이 브랜드로 만들어진 자동 묶음
   * (`grouping_key = date:<brand id>:kind`, docs/db-schema.md §6)도 풀어 지운다 — 브랜드 id는
   * `GENERATED ALWAYS`라 다시 올리면 번호가 바뀌고, 옛 묶음이 남으면 고아가 된다.
   * 수동 묶음(`is_manual`)은 사람이 만든 것이라 건드리지 않는다.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    const codes = this.brands.map((brand) => brand.code);
    const seeded = `SELECT "id" FROM "brand" WHERE "code" = ANY($1)`;
    const autoDrops = `SELECT "d"."id" FROM "drop_group" "d"
         JOIN "brand" "b" ON "d"."grouping_key" LIKE '%:' || "b"."id" || ':%'
        WHERE "b"."code" = ANY($1) AND "d"."is_manual" = false`;

    await queryRunner.query(`UPDATE "item" SET "brand_id" = NULL WHERE "brand_id" IN (${seeded})`, [
      codes,
    ]);
    await queryRunner.query(
      `UPDATE "item" SET "drop_id" = NULL WHERE "drop_id" IN (${autoDrops})`,
      [codes],
    );
    await queryRunner.query(`DELETE FROM "drop_group" WHERE "id" IN (${autoDrops})`, [codes]);
    await queryRunner.query(`DELETE FROM "brand" WHERE "code" = ANY($1)`, [codes]);
  }
}
