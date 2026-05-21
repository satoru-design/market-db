# Morning Summary 設計書

作成日: 2026-05-20
対象: market-db v10 への機能追加
ベース: 2026-05-20-market-db-v10-design.md

## 1. 目的

毎朝 5:30 JST に Slack `#market-db-alerts` へ「短くキレ味の良い」朝のブリーフィングを自動投稿する。
- 前営業日の JP/US 市場サマリ
- 当日の予測
- 持ち株への利確/ホールド/買い増し示唆

「読むのに10秒、判断材料として濃い」をUX原則とする。

## 2. スコープ

### 含む
- Vercel Cron `30 20 * * *` (UTC, =5:30 JST)
- Yahoo Finance unofficial JSON で指数取得（日経/TOPIX/ダウ/ナス/S&P500/USDJPY）
- Yahoo Finance unofficial Search API でニュース見出し取得（最大15件）
- Reuters Business RSS で補完ニュース取得（最大10件）
- KV から `profile:satoru.holdings`（自由記述テキスト）を取得
- Claude haiku-4-5 で 3部構成の短文を生成
- Slack Incoming Webhook へ Markdown 投稿
- ProfilePanel に holdings 用 textarea 追加

### 含まない（YAGNI）
- 銘柄テーブルの構造化保管
- 過去通知の保存/履歴ページ
- 個人最適化の学習（ユーザーがどの示唆に従ったか追跡など）
- 複数チャンネル配信
- Gemini との並列生成（v10 の Briefing UIでは並列だが、Slack 通知は1テキストで十分）
- 営業日判定（土日祝でも投稿。市場休場日のデータは前営業日のものになるだけ。手動で止めたい場合は cron を無効化）

## 3. アーキテクチャ

```
Vercel Cron */30 20 * * * (UTC) = 5:30 JST daily
  ↓ GET /api/cron/morning-summary (proxy PUBLIC_PATHS)
  ├─→ lib/market-snapshot.ts
  │   └─ Yahoo Finance Quote API (^N225, ^TOPX, ^GSPC, ^DJI, ^IXIC, USDJPY=X)
  ├─→ lib/news-fetch.ts
  │   ├─ Yahoo Finance Search (q=日経平均, ダウ, ナスダック, FRB)
  │   └─ Reuters RSS (feeds.reuters.com/reuters/businessNews)
  ├─→ lib/profile.ts.getProfile() → holdings text
  ├─→ lib/morning-prompt.ts (assemble prompt)
  ├─→ Anthropic SDK (claude-haiku-4-5)
  └─→ POST Slack Webhook
```

### モジュール責務
| ファイル | 責務 | 純粋性 |
|---|---|---|
| `lib/market-snapshot.ts` | Yahoo Finance から指数 6本を並列取得し、騰落率を計算 | I/O |
| `lib/news-fetch.ts` | Yahoo News Search + Reuters RSS から見出しを集約・重複除去 | I/O |
| `lib/morning-prompt.ts` | スナップショット + ニュース + holdings からプロンプト文字列を組み立てる | 純粋 (TDD) |
| `lib/profile.ts` | 既存。`holdings: string` を追加 | I/O |
| `app/api/cron/morning-summary/route.ts` | オーケストレーション + Claude 呼び出し + Slack 投稿 | I/O |
| `src/proxy.ts` | PUBLIC_PATHS に `/api/cron/morning-summary` 追加 | - |
| `vercel.json` | cron schedule 追加 | - |
| `components/ProfilePanel.tsx` | holdings textarea セクション追加 | UI |

## 4. データソース仕様

### 4.1 指数取得 (Yahoo Finance unofficial)
```
GET https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}?interval=1d&range=5d
Headers: User-Agent: Mozilla/5.0 ...
```
レスポンスの `chart.result[0].meta` から `regularMarketPrice`、`chartPreviousClose` を抽出。騰落率 = `(price - prevClose) / prevClose`。

対象シンボル:
- `^N225` (日経平均)
- `^TOPX` (TOPIX)
- `^GSPC` (S&P 500)
- `^DJI` (ダウ平均)
- `^IXIC` (NASDAQ Composite)
- `USDJPY=X` (ドル円)

並列 fetch。1件でも失敗したら `null` 扱いで継続。

### 4.2 ニュース取得

**Yahoo Finance Search**:
```
GET https://query1.finance.yahoo.com/v1/finance/search?q={QUERY}&newsCount=5&quotesCount=0
```
クエリ: `日経平均`, `ダウ`, `ナスダック`, `FRB`（各5件 → 計20件想定、重複除去後10-15件）。

レスポンスの `news[]` から `{ title, publisher, providerPublishTime, link }` を抽出。`providerPublishTime` (unix秒) が直近24h以内のもののみ採用。

**Reuters RSS**:
```
GET https://feeds.reuters.com/reuters/businessNews
```
XML パース不要（軽量正規表現で `<title>` と `<pubDate>` を抜く）。直近24h以内のもの最大10件。

**重複除去**: タイトル正規化（lowercase, 句読点除去）して set 化。

### 4.3 持ち株テキスト

`profile:satoru.holdings: string` (デフォルト空文字)。
書式は自由：
```
SPXL 50株 平均130円
QQQ 80株 平均380円
純金積立 60g
TLT 20株 平均95円（ヘッジ枠）
```

Claude にそのまま渡す。空文字なら「持ち株情報なし → 一般的な配分提案を出す」とプロンプトに明記。

## 5. プロンプト設計

`lib/morning-prompt.ts` が以下を組み立てる:

```
あなたは投資戦略アナリストです。以下のデータを基に、Slack投稿用の極めて短い朝のブリーフィングを日本語Markdownで出力してください。
全体で250文字以内、各セクション1-2行に圧縮、結論ファースト。

## 指標スナップショット
日経 38,920 (-1.2%) / TOPIX 2,710 (-0.8%)
ダウ 38,500 (+0.5%) / ナス 16,800 (+1.1%) / S&P 5,250 (+0.8%)
USDJPY 154.20 (-0.3%)
F&G 60 / VIX 18.06 / Skew 135.5 / US10Y 4.21%

## 直近24hニュース見出し
1. (Reuters) NVIDIA earnings beat...
2. (Yahoo!Japan) 植田総裁、利上げ慎重姿勢...
...

## ユーザーの持ち株
SPXL 50株 平均130円、QQQ 80株 平均380円

## 出力フォーマット (Slack mrkdwn互換)
📊 振り返り
[1-2行]

🔮 今日
[1-2行、メイン/リスク]

💡 持ち株
[各銘柄1行で 利確/HOLD/買い増し + 一言根拠]
```

`max_tokens: 600` で十分。

## 6. Slack 投稿フォーマット (例)

```
🌅 *2026-05-21 (Tue) Morning Briefing*

📊 振り返り
日経 -1.2% (植田発言で円高) / ナス +1.1% (NVIDIA決算)

🔮 今日
メイン: 米株続伸、日本株は円高で軟調
リスク: VIX再上昇なら全面安

💡 持ち株
SPXL: 利確一部検討（指数天井圏、F&G 60）
QQQ: HOLD（成長モメンタム継続）
純金積立: 継続

📈 <https://market-db-five.vercel.app/|Daily Briefing>
```

## 7. データモデル変更

```ts
// src/lib/profile.ts
export type Profile = {
  cashPool: number;
  monthlyBudget: number;
  maxSingleAsset: number;
  maxDrawdownPct: number;
  adoptedScenario: 'worse' | 'current' | 'better';
  holdings: string;  // NEW: 自由記述テキスト
};

const DEFAULT: Profile = {
  // ... existing
  holdings: '',  // NEW
};
```

## 8. proxy.ts 変更

```ts
const PUBLIC_PATHS = [
  '/api/cron/alert',
  '/api/cron/morning-summary',  // NEW
  '/api/market-data',
];
```

## 9. vercel.json 変更

```json
{
  "crons": [
    { "path": "/api/cron/alert", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/morning-summary", "schedule": "30 20 * * *" }
  ]
}
```

## 10. テスト方針

- `lib/morning-prompt.ts` → vitest で「指標・ニュース・holdings からプロンプト文字列が期待通り組み立てられる」「holdings 空でも壊れない」を検証
- `lib/market-snapshot.ts` → 1件失敗時の null 継続を vitest で確認
- `lib/news-fetch.ts` → タイトル重複除去・24h フィルタを vitest で確認
- cron route → 手動 curl 1回で Slack 配信を確認、E2E自動テストは入れない

## 11. エラーハンドリング

| 失敗 | 挙動 |
|---|---|
| Yahoo Quote 一部失敗 | 取れたものだけで進行、欠損は `--` で表示 |
| Yahoo News 全失敗 | ニュースなしで Claude に渡す（プロンプトに「ニュース取得失敗」明記） |
| Reuters RSS 失敗 | 同上 |
| Claude API 失敗 | Slack に「⚠️ Morning Briefing 生成失敗（[error]）」を投稿 |
| Slack POST 失敗 | console.error のみ、リトライなし |

## 12. 非機能

| 項目 | 目標 |
|---|---|
| 月間コスト増 | Claude 30回 × 600token ≈ ¥30 |
| 実行時間 | <15秒（指数並列 + ニュース並列 + Claude） |
| 重複防止 | 不要（1日1回固定実行） |
| TZ | cron は UTC `30 20`、本文の日付表示は JST `Asia/Tokyo` で `toLocaleDateString` |

## 13. Vibe Coding 六条チェック

1. **セキュリティ**: Slack URL は env、Yahoo は public、入力なし（cron 自動起動のみ）
2. **コスト**: 月¥30増、Yahoo/Reuters 無料
3. **法規制**: Yahoo unofficial は v10 でも既に利用中（追加リスクなし）、Reuters は public RSS（許可された配信形式）、スクレイピング無し
4. **データ不可逆性**: holdings は plain string で KV、いつでも編集・削除可
5. **性能**: 1cron 1ユーザー、負荷問題なし
6. **検証可能性**: Yahoo Quote/Search/Reuters RSS いずれも実在確認済、Claude haiku-4-5 は v10 で稼働確認済

## 14. 実装フェーズ

1. **Phase A**: `profile.ts` に holdings field 追加 + ProfilePanel に textarea
2. **Phase B**: `lib/market-snapshot.ts`（TDD: 整形ロジックは純粋関数として分離）
3. **Phase C**: `lib/news-fetch.ts`（TDD: 重複除去・24hフィルタは純粋関数）
4. **Phase D**: `lib/morning-prompt.ts`（TDD: 純粋）
5. **Phase E**: `app/api/cron/morning-summary/route.ts` + proxy.ts + vercel.json
6. **Phase F**: 手動 curl 検証 → 本番デプロイ → 翌朝 5:30 で初回自動配信を確認

各フェーズ後に手動確認 → 次へ。
