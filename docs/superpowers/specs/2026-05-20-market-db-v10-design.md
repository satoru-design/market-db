# Market Risk Pro v10 ─ 設計書

作成日: 2026-05-20
対象: 小池慧 個人専用ツール（market-db-five.vercel.app）
ベース: 現行 Market Risk Pro Alpha Terminal v9.5

## 1. 目的

現行 v9.5 の「指標 → BUY/SELL 判定」コア機能を維持しつつ、以下3つの不満を解消する。

1. 「買え」と判定されても「いくら・何を」のアクションが弱い
2. 過去の自分の判断（シグナル）の答え合わせができない
3. 資産・シナリオの幅が狭い

加えて、利用シーン（朝PC・場中スマホ・急変アラート）に最適化した3モード UI を導入する。

## 2. スコープ

### 含む
- 3シナリオ並列提示（1段悪化／現状／1段改善）
- 運用プロファイル保存（Vercel KV、複数端末同期）
- DCAバックテスト（過去20-30底値イベント、資産別累積リターン）
- 3モード UI（Daily Briefing / Quick Glance / Alert）
- 急変アラート（15分Cron → Slack `#market-db-alerts`）
- AI Briefing 二重化（Claude haiku-4-5 + Gemini 3.1 Pro をタブ切替）
- 弱保護（URL secret key + middleware）
- 手入力UIの撤廃（自動取得値だけ大きく表示、微調整は折りたたみ内）

### 含まない（YAGNI）
- トレード履歴管理／PnL追跡
- 証券会社連携（CSV/API）
- 他者向け公開／認証
- 法務ページ／LP／OGP整備
- データの自動学習・モデル更新

## 3. 全体アーキテクチャ

### スタック
- Next.js 16 / React 19 / Tailwind 4 / Vercel Hobby
- AGENTS.md の警告に従い、Next.js 16 の breaking changes（route handlers, dynamic, fetch cache）を実装前に `node_modules/next/dist/docs/` で確認

### データ層

| 層 | 内容 | 取得方法 | 既存/新規 |
|---|---|---|---|
| 指標 | F&G | CNN API | 既存維持 |
| 指標 | VIX/Skew/10Y/DXY/Gold/Silver | Yahoo Finance unofficial | 既存維持 |
| 設定 | プロファイル | Vercel KV | 新規 |
| ヒストリカル | 底値イベント＋月次価格 | `public/data/historical.json` 静的 | 新規 |
| AI | Briefing 文章 | Claude + Gemini 並列 | Claude 追加 |
| 通知 | 急変アラート | Vercel Cron → Slack Webhook | 新規 |

### アクセス制御
- URL 固定 secret `?key=xxxx` + middleware チェック
- ログイン画面なし、ブックマーク1つで端末またぎ可
- 漏洩時は `MARKET_DB_SECRET_KEY` 環境変数を差し替えで即無効化

### モジュール構造
```
src/
  middleware.ts                 … secret key チェック（新規）
  app/
    page.tsx                    … Daily Briefing（既存page.tsx刷新）
    glance/page.tsx             … Quick Glance（新規・スマホ専用）
    alert/page.tsx              … Alert モード（新規）
    api/
      market-data/route.ts      … 指標取得（既存）
      insight/claude/route.ts   … Claude Briefing（新規）
      insight/gemini/route.ts   … 旧 alpha-insight をリネーム
      profile/route.ts          … KV CRUD（新規）
      backtest/route.ts         … DCA計算（新規）
      cron/alert/route.ts       … 急変判定 → Slack（新規）
  lib/
    signals.ts                  … BUY/SELL判定（page.tsxから抽出）
    scenarios.ts                … 3シナリオ生成（新規）
    allocation.ts               … 配分算出（新規）
    profile.ts                  … KV CRUD（新規）
    backtest.ts                 … DCAリターン計算（新規）
  data/
    portfolio.ts                … portfolioData を分離（新規）
public/data/
  historical.json               … 過去イベント＋月次価格（新規）
vercel.json                     … Cron 設定（新規）
```

### 環境変数
- `MARKET_DB_SECRET_KEY` … URL secret
- `MARKET_DB_SLACK_WEBHOOK` … `#market-db-alerts` 用
- `ANTHROPIC_API_KEY` … Claude
- `GEMINI_API_KEY` … 既存
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` … Vercel KV

## 4. 画面構成

### 4.1 Daily Briefing（PC `/`）
一画面完結、印刷・スクショ保存しやすいレイアウト。

- ヘッダー：日付・JST 時刻・最終データ取得時刻
- メイン：現在フェーズ大型表示（HEAT/PERFECT/HIGH/WATCH/NEUTRAL）＋一言アクション
- 指標サマリ：F&G/VIX/Skew/10Y/DXY/Gold/GS Ratio を1行で
- **3シナリオ並列カード**：1段悪化 / 現状（強調）/ 1段改善 を横並び、それぞれフェーズ・アクション・月予算配分を表示
- AI Briefing：Claude タブ・Gemini タブの切替
- 8カテゴリ × 配分テーブル（既存維持、現状フェーズを反映）
- DCA Backtest：過去20イベント、資産別の累積リターン棒グラフ＋勝率

### 4.2 Quick Glance（スマホ `/glance`）
3秒で意思決定、スクロール最小。

- 巨大フェーズ表示＋一言（例: `HIGH ⚡ 強気買付`）
- 指標2行（F&G / VIX / Skew、現値のみ）
- 今日の配分2-3行（最重要資産のみ：TQQQ/SPXL/QQQ）
- 「▼ 詳細を見る」リンクで Daily Briefing へ遷移

### 4.3 Alert（急変時 `/alert?event=xxx`）
Slack 通知のリンクから開く緊急対応画面。

- 発火したシグナル名と発火時刻
- 直前との指標差分（F&G -14, VIX +8.3 等）
- そのシグナルに対するアクション提案
- 「履歴：過去同種シグナル発火後のリターン」を3-5件並べる
- Daily Briefing への遷移リンク

## 5. データモデル

### 5.1 Vercel KV
```ts
// profile:satoru
{
  cashPool: number,          // 円
  monthlyBudget: number,     // 500000
  maxSingleAsset: number,    // 200000
  maxDrawdownPct: number,    // 30
  adoptedScenario: "worse" | "current" | "better"
}

// snapshot:latest（指標API障害時のフォールバック）
{
  fg, vix, skew, yield, dxy, gold, silver,
  fetchedAt: ISO8601
}

// alert:lastFired（重複通知防止、24h ロック）
{
  [eventKey: string]: ISO8601
}
```

### 5.2 Historical JSON（`public/data/historical.json`）
```ts
{
  events: Array<{
    date: string,             // "2024-08-05"
    intensity: "PERFECT" | "HIGH" | "WATCH",
    fg: number,
    vix_peak: number,
    skew_peak: number,
    context: string,          // "植田ショック"
    returns: { [ticker: string]: number }   // 発火日 → 現在の累積リターン
  }>,
  monthly_prices: {
    [ticker: string]: Array<{ date: string, close: number }>
  }
}
```

過去イベントは 20-30 件（2018年以降の主要底値）を手動キュレーション + 月次価格は主要10資産 × 5年分。

## 6. ロジック

### 6.1 シグナル判定（`lib/signals.ts`）
既存 page.tsx ロジックを移植：
- BUY シグナル: F&G≤30 / VIX≥28 / Skew≤118
- 該当数で PERFECT(3) / HIGH(2) / WATCH(1) を決定
- F&G≥75 で HEAT
- それ以外 NEUTRAL

### 6.2 シナリオ生成（`lib/scenarios.ts`）
現在フェーズの 1段隣を計算：
```
HEAT ← PERFECT ← HIGH ← WATCH ← NEUTRAL
（悪化方向）              （改善方向）
```
- 端（HEAT / NEUTRAL）は片方のみ
- 各シナリオに対し配分算出を呼び、3枚分のカードデータを返す

### 6.3 配分算出（`lib/allocation.ts`）
プロファイルを反映：
- 既存 `portfolioData[].strategy[phase].budget` を起点
- `maxSingleAsset` を超える場合はクリップ
- HEAT 時の超過分は cashPool に積み増し計上

### 6.4 DCAバックテスト（`lib/backtest.ts`）
historical.events を順に走査し、資産別に：
- 発火日に1万円 / 5万円 / 10万円 等で買っていたら現在いくらか
- 累積リターン、勝率（リターン>0 の割合）、平均リターンを返す

### 6.5 急変判定（`api/cron/alert/route.ts`）
15分毎に起動：
1. 現在指標を取得（既存 market-data エンドポイント流用）
2. 閾値判定：VIX>30 / F&G<20 / Skew>150 / フェーズ変化
3. KV `alert:lastFired` で 24h ロックチェック
4. 該当があれば Slack Webhook へ通知 + KV 更新

## 7. 通知

### Slack 通知フォーマット（`#market-db-alerts`）
```
🚨 PHASE CHANGE: HIGH → PERFECT
F&G: 18 (↓ -14)  VIX: 32.4 (↑ +8.3)  Skew: 142
📊 https://market-db-five.vercel.app/alert?event=phase_perfect&key=xxxx
```

### Vercel Cron
- `vercel.json`: `*/15 * * * *` で `/api/cron/alert`
- Hobby 無料枠で十分（1日 96回）

## 8. テスト方針

- `lib/signals.ts` … BUY 判定の境界値テスト（vitest）
- `lib/scenarios.ts` … 各フェーズで隣接シナリオが正しく出るか
- `lib/allocation.ts` … プロファイル制約が反映されるか
- `lib/backtest.ts` … historical.json サンプルで期待値一致
- API ルート … モックでステータスコード・形を確認
- UI … 個人専用かつスピード優先のため手動確認のみ（自動E2Eは入れない）

## 9. 非機能

### コスト
- Vercel Hobby（無料）
- Claude API：月 ¥100-300（数十回/日）
- Gemini API：月 ¥0-100
- Vercel KV：無料枠内（30k req/月）
- **想定月額：500円以下**

### 性能
- Daily Briefing 描画 <2秒（指標API並列 + ISR/SWR）
- Quick Glance <1秒（KV snapshot を即返す）
- Cron 実行 <5秒/回

### 障害時挙動
- 指標API失敗 → KV `snapshot:latest` を表示、最終取得時刻併記
- Claude/Gemini 失敗 → 該当タブにエラーバナー、もう一方は表示維持
- Slack Webhook 失敗 → ログのみ、次回 Cron で再判定

### Vibe Coding 六条
1. **セキュリティ**: secret key 弱保護、API key は env、入力なしで XSS リスク低
2. **コスト**: 月500円以下、Cron 15分で爆発しない
3. **法規制**: 個人専用、投資助言業に該当せず
4. **データ不可逆性**: KV 薄スキーマ、historical.json は静的で再生成可
5. **性能**: 個人専用 = 1ユーザー、負荷問題なし
6. **検証可能性**: CNN/Yahoo Finance/Claude/Gemini/Vercel KV/Cron すべて実在確認済

## 10. 実装フェーズ

1. **Phase 1**：手入力UI削除＋既存 page.tsx を `lib/` に責務分離
2. **Phase 2**：3シナリオ並列カード追加
3. **Phase 3**：Vercel KV 導入＋プロファイル機能
4. **Phase 4**：historical.json 整備＋DCAバックテスト
5. **Phase 5**：Quick Glance 画面
6. **Phase 6**：Claude Briefing 追加＋タブ切替
7. **Phase 7**：Cron + Slack アラート
8. **Phase 8**：Alert モード画面
9. **Phase 9**：secret key middleware

各フェーズで動作確認 → デプロイ → 次へ。
