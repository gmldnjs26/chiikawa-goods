# chiikawa-goods

ちいかわ グッズの発売・予約・再入荷情報をひとつのタイムラインにまとめる個人プロジェクトです。

**非営利・無収益で運営します。** 広告・アフィリエイト・購入代行は行いません。

---

## サイト運営者の方へ / For site operators

このリポジトリのクローラーは以下の方針で動作します。

- User-Agent: `chiikawa-goods-bot/0.1 (+https://github.com/gmldnjs26/chiikawa-goods)`
- `robots.txt` を解析し、`Crawl-delay` を含めて遵守します
- 同時リクエストは 1、サイトごとに最小間隔を確保します
- **本文の転載は行いません。** 商品名・価格・日付・公式リンクのみを保存します
- 画像は公式ページへのリンク参照のみで、ホスティングしません
- 価格比較・転売目的の利用は行いません

### 削除・停止のご依頼

**GitHub Issues** よりご連絡ください。特定サイトの収集停止・掲載削除に対応します。
確認次第、該当ソースを停止します。

---

## ドキュメント

| ファイル | 内容 |
| --- | --- |
| [docs/plan.md](docs/plan.md) | 企画（何を・なぜ） |
| [docs/data-collection-design.md](docs/data-collection-design.md) | 収集・データ設計（どうやって） |
| [docs/tech-stack.md](docs/tech-stack.md) | 技術選定 |

> ドキュメントは韓国語で記述されています。サービス自体の提供言語は日本語です。

## ステータス

**設計段階。** 実装は未着手です。
