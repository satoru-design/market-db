# Morning Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 毎朝5:30 JST、Vercel Cron が Yahoo Finance 指数 + Yahoo/Reuters ニュース + ユーザーの持ち株テキストを Claude haiku-4-5 に渡し、Slack `#market-db-alerts` に短いブリーフィングを自動投稿する。

**Architecture:** 純粋ロジック（プロンプト組立・ニュース重複除去）は `src/lib/*.ts` に分離し vitest でカバー。I/O（Yahoo/Reuters fetch、Claude、Slack、KV）は `src/app/api/cron/morning-summary/route.ts` で薄くオーケストレーション。`Profile` 型に `holdings: string` を追加し ProfilePanel に textarea を追加。

**Tech Stack:** Next.js 16 App Router, Vercel Cron, Vercel KV (Upstash), `@anthropic-ai/sdk`, Yahoo Finance unofficial JSON, Reuters RSS, vitest.

---

## Phase A: Profile に holdings 追加

### Task A.1: Profile 型と KV デフォルトに holdings 追加

**Files:**
- Modify: `src/lib/profile.ts`

- [ ] **Step 1: 型と DEFAULT を更新**

`src/lib/profile.ts` を以下に書き換え（既存ロジックは保持、`holdings` だけ追加）:

```ts
import { kv } from '@vercel/kv';

export type Profile = {
  cashPool: number;
  monthlyBudget: number;
  maxSingleAsset: number;
  maxDrawdownPct: number;
  adoptedScenario: 'worse' | 'current' | 'better';
  holdings: string;
};

const DEFAULT: Profile = {
  cashPool: 0,
  monthlyBudget: 500000,
  maxSingleAsset: 200000,
  maxDrawdownPct: 30,
  adoptedScenario: 'current',
  holdings: '',
};

const KEY = 'profile:satoru';

export async function getProfile(): Promise<Profile> {
  const stored = await kv.get<Profile>(KEY);
  return { ...DEFAULT, ...(stored ?? {}) };
}

export async function setProfile(patch: Partial<Profile>): Promise<Profile> {
  const current = await getProfile();
  const next = { ...current, ...patch };
  await kv.set(KEY, next);
  return next;
}
```

- [ ] **Step 2: ビルド確認**

実行: `npm run build`
期待: 成功（TypeScript エラーなし）。

- [ ] **Step 3: コミット**

実行:
```
git add src/lib/profile.ts
git commit -m "feat: add holdings text field to Profile"
```

### Task A.2: ProfilePanel に holdings textarea 追加

**Files:**
- Modify: `src/components/ProfilePanel.tsx`

- [ ] **Step 1: textarea セクション追加**

`src/components/ProfilePanel.tsx` のファイル全体を以下に置換:

```tsx
"use client";
import { useEffect, useState } from 'react';
import type { Profile } from '@/lib/profile';

export function ProfilePanel() {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(setProfile);
  }, []);

  const save = async (patch: Partial<Profile>) => {
    const next = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then(r => r.json());
    setProfile(next);
  };

  if (!profile) return null;

  return (
    <div className="max-w-7xl mx-auto mt-12">
      <button onClick={() => setOpen(!open)} className="text-xs text-slate-500 uppercase font-black tracking-widest">
        {open ? '▲ プロファイルを閉じる' : '▼ 運用プロファイルを編集'}
      </button>
      {open && (
        <div className="glass-card rounded-2xl p-6 mt-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['cashPool', 'monthlyBudget', 'maxSingleAsset', 'maxDrawdownPct'] as const).map(key => (
              <label key={key} className="block">
                <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest block mb-1">{key}</span>
                <input
                  type="number"
                  value={profile[key]}
                  onChange={e => save({ [key]: Number(e.target.value) } as Partial<Profile>)}
                  className="w-full bg-black/40 border border-slate-700 rounded px-3 py-2 text-white font-mono"
                />
              </label>
            ))}
          </div>
          <label className="block">
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest block mb-1">
              Holdings (自由記述・朝のブリーフィングで Claude に渡される)
            </span>
            <textarea
              value={profile.holdings}
              onChange={e => save({ holdings: e.target.value })}
              rows={6}
              placeholder="例: SPXL 50株 平均130円&#10;QQQ 80株 平均380円&#10;純金積立 60g"
              className="w-full bg-black/40 border border-slate-700 rounded px-3 py-2 text-white font-mono text-sm leading-relaxed"
            />
          </label>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: ビルド確認**

実行: `npm run build`

- [ ] **Step 3: 動作確認（手動）**

実行:
```
set -a; source .env.local; set +a
npm run dev &
sleep 6
curl -s -X PATCH http://localhost:3000/api/profile -H "Content-Type: application/json" -d '{"holdings":"smoke test"}'
curl -s http://localhost:3000/api/profile
```
期待: 2回目の GET レスポンスに `"holdings":"smoke test"` が含まれる。

クリーンアップ:
```
curl -s -X PATCH http://localhost:3000/api/profile -H "Content-Type: application/json" -d '{"holdings":""}'
```
dev server を kill。

- [ ] **Step 4: コミット**

実行:
```
git add src/components/ProfilePanel.tsx
git commit -m "feat: add holdings textarea to ProfilePanel"
```

---

## Phase B: market-snapshot.ts（指数スナップショット取得）

### Task B.1: calcChangePct / formatSnapshot を TDD で実装

**Files:**
- Create: `src/lib/market-snapshot.test.ts`
- Create: `src/lib/market-snapshot.ts`

- [ ] **Step 1: 失敗テストを書く**

`src/lib/market-snapshot.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { calcChangePct, formatSnapshot, type IndexSnapshot } from './market-snapshot';

describe('calcChangePct', () => {
  it('上昇を正のパーセントで返す', () => {
    expect(calcChangePct(105, 100)).toBeCloseTo(0.05);
  });
  it('下落を負のパーセントで返す', () => {
    expect(calcChangePct(95, 100)).toBeCloseTo(-0.05);
  });
  it('prev が 0/null/undefined なら null', () => {
    expect(calcChangePct(100, 0)).toBeNull();
    expect(calcChangePct(100, null)).toBeNull();
  });
});

describe('formatSnapshot', () => {
  it('全指数あり: 1行にまとめる', () => {
    const snap: IndexSnapshot = {
      n225: { price: 38920, changePct: -0.012 },
      topx: { price: 2710, changePct: -0.008 },
      gspc: { price: 5250, changePct: 0.008 },
      dji: { price: 38500, changePct: 0.005 },
      ixic: { price: 16800, changePct: 0.011 },
      usdjpy: { price: 154.20, changePct: -0.003 },
    };
    const out = formatSnapshot(snap);
    expect(out).toContain('日経 38,920 (-1.2%)');
    expect(out).toContain('ナス 16,800 (+1.1%)');
    expect(out).toContain('USDJPY 154.20');
  });
  it('一部 null は -- 表示で継続', () => {
    const snap: IndexSnapshot = {
      n225: null,
      topx: { price: 2710, changePct: -0.008 },
      gspc: null,
      dji: { price: 38500, changePct: 0.005 },
      ixic: { price: 16800, changePct: 0.011 },
      usdjpy: { price: 154.20, changePct: -0.003 },
    };
    const out = formatSnapshot(snap);
    expect(out).toContain('日経 --');
    expect(out).toContain('S&P --');
  });
});
```

- [ ] **Step 2: テスト実行（FAIL確認）**

実行: `npm test`
期待: `Cannot find module './market-snapshot'`。

- [ ] **Step 3: market-snapshot.ts 実装**

`src/lib/market-snapshot.ts`:

```ts
export type IndexQuote = { price: number; changePct: number | null } | null;

export type IndexSnapshot = {
  n225: IndexQuote;
  topx: IndexQuote;
  gspc: IndexQuote;
  dji: IndexQuote;
  ixic: IndexQuote;
  usdjpy: IndexQuote;
};

const SYMBOL_MAP = {
  n225: '^N225',
  topx: '^TOPX',
  gspc: '^GSPC',
  dji: '^DJI',
  ixic: '^IXIC',
  usdjpy: 'USDJPY=X',
} as const;

type Key = keyof typeof SYMBOL_MAP;

export function calcChangePct(current: number, prev: number | null | undefined): number | null {
  if (!prev || prev === 0) return null;
  return (current - prev) / prev;
}

async function fetchOne(symbol: string): Promise<IndexQuote> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        next: { revalidate: 0 },
      }
    );
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice;
    const prev = meta.chartPreviousClose;
    if (typeof price !== 'number') return null;
    return { price, changePct: calcChangePct(price, prev) };
  } catch {
    return null;
  }
}

export async function fetchSnapshot(): Promise<IndexSnapshot> {
  const keys = Object.keys(SYMBOL_MAP) as Key[];
  const results = await Promise.all(keys.map(k => fetchOne(SYMBOL_MAP[k])));
  const snap = {} as IndexSnapshot;
  keys.forEach((k, i) => {
    snap[k] = results[i];
  });
  return snap;
}

function fmtQuote(label: string, q: IndexQuote, priceDigits = 0): string {
  if (!q) return `${label} --`;
  const priceStr = q.price.toLocaleString('en-US', { minimumFractionDigits: priceDigits, maximumFractionDigits: priceDigits });
  if (q.changePct === null) return `${label} ${priceStr}`;
  const pct = (q.changePct * 100).toFixed(1);
  const sign = q.changePct >= 0 ? '+' : '';
  return `${label} ${priceStr} (${sign}${pct}%)`;
}

export function formatSnapshot(snap: IndexSnapshot): string {
  const line1 = `${fmtQuote('日経', snap.n225)} / ${fmtQuote('TOPIX', snap.topx)}`;
  const line2 = `${fmtQuote('ダウ', snap.dji)} / ${fmtQuote('ナス', snap.ixic)} / ${fmtQuote('S&P', snap.gspc)}`;
  const line3 = fmtQuote('USDJPY', snap.usdjpy, 2);
  return `${line1}\n${line2}\n${line3}`;
}
```

- [ ] **Step 4: テスト実行（PASS確認）**

実行: `npm test`
期待: 25 passing (20 + 5 new)。

- [ ] **Step 5: コミット**

実行:
```
git add src/lib/market-snapshot.ts src/lib/market-snapshot.test.ts
git commit -m "feat: add market snapshot fetcher with formatter"
```

---

## Phase C: news-fetch.ts（ニュース取得・重複除去）

### Task C.1: 純粋関数を TDD

**Files:**
- Create: `src/lib/news-fetch.test.ts`
- Create: `src/lib/news-fetch.ts`

- [ ] **Step 1: 失敗テストを書く**

`src/lib/news-fetch.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  normalizeTitle,
  dedupeNews,
  filterRecent24h,
  formatNews,
  type NewsItem,
} from './news-fetch';

describe('normalizeTitle', () => {
  it('lowercase + 記号除去', () => {
    expect(normalizeTitle('FED, Hikes Rates!')).toBe('fed hikes rates');
  });
  it('日本語の句読点も除去', () => {
    expect(normalizeTitle('日経、続伸。')).toBe('日経続伸');
  });
});

describe('dedupeNews', () => {
  it('同タイトル正規化が重複したら最初の1件のみ', () => {
    const items: NewsItem[] = [
      { title: 'FED Hikes Rates', publisher: 'Reuters', publishedAt: 1, link: 'a' },
      { title: 'fed, hikes, rates!', publisher: 'Yahoo', publishedAt: 2, link: 'b' },
      { title: 'NVDA earnings beat', publisher: 'CNBC', publishedAt: 3, link: 'c' },
    ];
    expect(dedupeNews(items)).toHaveLength(2);
    expect(dedupeNews(items)[0].link).toBe('a');
  });
});

describe('filterRecent24h', () => {
  it('24h以内は残り、超過は除外', () => {
    const now = 1_700_000_000;
    const items: NewsItem[] = [
      { title: 'a', publisher: 'x', publishedAt: now - 3600, link: 'a' },
      { title: 'b', publisher: 'x', publishedAt: now - 86400 * 2, link: 'b' },
    ];
    expect(filterRecent24h(items, now)).toHaveLength(1);
    expect(filterRecent24h(items, now)[0].title).toBe('a');
  });
});

describe('formatNews', () => {
  it('番号付きで publisher と title を 1行ずつ', () => {
    const items: NewsItem[] = [
      { title: 'First headline', publisher: 'Reuters', publishedAt: 1, link: 'a' },
      { title: 'Second headline', publisher: 'Yahoo!Japan', publishedAt: 2, link: 'b' },
    ];
    const out = formatNews(items);
    expect(out).toContain('1. (Reuters) First headline');
    expect(out).toContain('2. (Yahoo!Japan) Second headline');
  });
  it('空配列ならニュース取得失敗メッセージ', () => {
    expect(formatNews([])).toBe('ニュース取得失敗（全ソース失敗）');
  });
});
```

- [ ] **Step 2: テスト実行（FAIL確認）**

実行: `npm test`

- [ ] **Step 3: news-fetch.ts 実装**

`src/lib/news-fetch.ts`:

```ts
export type NewsItem = {
  title: string;
  publisher: string;
  publishedAt: number;
  link: string;
};

const YAHOO_QUERIES = ['日経平均', 'ダウ', 'ナスダック', 'FRB'];
const REUTERS_RSS = 'https://feeds.reuters.com/reuters/businessNews';

export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[!?.,;:、。!?,.;:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function dedupeNews(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const item of items) {
    const key = normalizeTitle(item.title);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

export function filterRecent24h(items: NewsItem[], nowSec: number): NewsItem[] {
  const cutoff = nowSec - 86400;
  return items.filter(i => i.publishedAt >= cutoff);
}

async function fetchYahooQuery(query: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=5&quotesCount=0`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        next: { revalidate: 0 },
      }
    );
    const data = await res.json();
    const news = data?.news ?? [];
    return news
      .filter((n: { title?: string }) => typeof n?.title === 'string')
      .map((n: { title: string; publisher?: string; providerPublishTime?: number; link?: string }) => ({
        title: n.title,
        publisher: n.publisher ?? 'Yahoo',
        publishedAt: n.providerPublishTime ?? 0,
        link: n.link ?? '',
      }));
  } catch {
    return [];
  }
}

async function fetchReutersRss(): Promise<NewsItem[]> {
  try {
    const res = await fetch(REUTERS_RSS, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      next: { revalidate: 0 },
    });
    const text = await res.text();
    const items: NewsItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(text)) !== null) {
      const block = match[1];
      const title = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(block)?.[1]?.trim() ?? '';
      const link = /<link>([\s\S]*?)<\/link>/.exec(block)?.[1]?.trim() ?? '';
      const pubDate = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(block)?.[1]?.trim() ?? '';
      const publishedAt = pubDate ? Math.floor(new Date(pubDate).getTime() / 1000) : 0;
      if (title) items.push({ title, publisher: 'Reuters', publishedAt, link });
      if (items.length >= 10) break;
    }
    return items;
  } catch {
    return [];
  }
}

export async function fetchAllNews(nowSec: number = Math.floor(Date.now() / 1000)): Promise<NewsItem[]> {
  const [yahooResults, reuters] = await Promise.all([
    Promise.all(YAHOO_QUERIES.map(fetchYahooQuery)),
    fetchReutersRss(),
  ]);
  const all = [...yahooResults.flat(), ...reuters];
  return dedupeNews(filterRecent24h(all, nowSec)).slice(0, 15);
}

export function formatNews(items: NewsItem[]): string {
  if (items.length === 0) return 'ニュース取得失敗（全ソース失敗）';
  return items.map((n, i) => `${i + 1}. (${n.publisher}) ${n.title}`).join('\n');
}
```

- [ ] **Step 4: テスト実行（PASS確認）**

実行: `npm test`
期待: 32 passing (25 + 7 new)。

- [ ] **Step 5: コミット**

実行:
```
git add src/lib/news-fetch.ts src/lib/news-fetch.test.ts
git commit -m "feat: add news fetcher with dedupe and 24h filter"
```

---

## Phase D: morning-prompt.ts（プロンプト組立）

### Task D.1: buildMorningPrompt を TDD

**Files:**
- Create: `src/lib/morning-prompt.test.ts`
- Create: `src/lib/morning-prompt.ts`

- [ ] **Step 1: 失敗テストを書く**

`src/lib/morning-prompt.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildMorningPrompt } from './morning-prompt';

describe('buildMorningPrompt', () => {
  it('全要素を含む完全プロンプトを生成', () => {
    const out = buildMorningPrompt({
      indicatorsBlock: '日経 38,920 (-1.2%)',
      extrasBlock: 'F&G 60 / VIX 18',
      newsBlock: '1. (Reuters) Test headline',
      holdings: 'SPXL 50株',
    });
    expect(out).toContain('日経 38,920 (-1.2%)');
    expect(out).toContain('F&G 60 / VIX 18');
    expect(out).toContain('1. (Reuters) Test headline');
    expect(out).toContain('SPXL 50株');
    expect(out).toContain('250文字以内');
    expect(out).toContain('📊 振り返り');
    expect(out).toContain('🔮 今日');
    expect(out).toContain('💡 持ち株');
  });

  it('holdings 空文字でも壊れず、一般配分提案を促す文言を含む', () => {
    const out = buildMorningPrompt({
      indicatorsBlock: '日経 38,920',
      extrasBlock: 'F&G 60',
      newsBlock: '1. (Reuters) Test',
      holdings: '',
    });
    expect(out).toContain('持ち株情報なし');
    expect(out).toContain('一般的な配分提案');
  });
});
```

- [ ] **Step 2: テスト実行（FAIL確認）**

実行: `npm test`

- [ ] **Step 3: morning-prompt.ts 実装**

`src/lib/morning-prompt.ts`:

```ts
export type PromptInput = {
  indicatorsBlock: string;
  extrasBlock: string;
  newsBlock: string;
  holdings: string;
};

export function buildMorningPrompt(input: PromptInput): string {
  const holdingsSection = input.holdings.trim()
    ? input.holdings
    : '持ち株情報なし。一般的な配分提案を1-2行で出してください。';

  return `あなたは投資戦略アナリストです。以下のデータを基に、Slack投稿用の極めて短い朝のブリーフィングを日本語Markdownで出力してください。
全体で250文字以内、各セクション1-2行に圧縮、結論ファーストで断定的に。
銘柄ティッカーは正確に、数値は短く。前置きや謝辞・自己紹介は一切不要。

## 指標スナップショット
${input.indicatorsBlock}
${input.extrasBlock}

## 直近24hニュース見出し
${input.newsBlock}

## ユーザーの持ち株
${holdingsSection}

## 出力フォーマット (Slack mrkdwn互換、絵文字は以下を使う)
📊 振り返り
[1-2行: 日米市場の要点、ニュース文脈を1つ織り込む]

🔮 今日
[1-2行: メイン/リスクシナリオ、断定的に]

💡 持ち株
[各銘柄1行で 利確/HOLD/買い増し + 一言根拠。持ち株なしなら一般配分1-2行]
`;
}
```

- [ ] **Step 4: テスト実行（PASS確認）**

実行: `npm test`
期待: 34 passing (32 + 2 new)。

- [ ] **Step 5: コミット**

実行:
```
git add src/lib/morning-prompt.ts src/lib/morning-prompt.test.ts
git commit -m "feat: add morning prompt builder"
```

---

## Phase E: cron route + proxy + vercel.json

### Task E.1: PUBLIC_PATHS と vercel.json 更新

**Files:**
- Modify: `src/proxy.ts`
- Modify: `vercel.json`

- [ ] **Step 1: proxy.ts の PUBLIC_PATHS 更新**

`src/proxy.ts` の PUBLIC_PATHS 配列を以下に置き換え:

```ts
const PUBLIC_PATHS = [
  '/api/cron/alert',
  '/api/cron/morning-summary',
  '/api/market-data',
];
```

- [ ] **Step 2: vercel.json の crons 配列に追加**

`vercel.json` を以下に書き換え:

```json
{
  "crons": [
    { "path": "/api/cron/alert", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/morning-summary", "schedule": "30 20 * * *" }
  ]
}
```

(`30 20 * * *` UTC = 05:30 JST daily)

- [ ] **Step 3: ビルド確認**

実行: `npm run build`
期待: 成功、`vercel.json` パース OK。

- [ ] **Step 4: コミット**

実行:
```
git add src/proxy.ts vercel.json
git commit -m "chore: register morning-summary cron and public path"
```

### Task E.2: morning-summary route 実装

**Files:**
- Create: `src/app/api/cron/morning-summary/route.ts`

- [ ] **Step 1: route ファイル作成**

`src/app/api/cron/morning-summary/route.ts`:

```ts
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { fetchSnapshot, formatSnapshot } from '@/lib/market-snapshot';
import { fetchAllNews, formatNews } from '@/lib/news-fetch';
import { buildMorningPrompt } from '@/lib/morning-prompt';
import { getProfile } from '@/lib/profile';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function jstDateString(): string {
  const now = new Date();
  return now.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
}

async function sendSlack(text: string): Promise<void> {
  const url = process.env.MARKET_DB_SLACK_WEBHOOK;
  if (!url) return;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const origin = new URL(request.url).origin;
  const dateLabel = jstDateString();

  try {
    const [snap, news, marketDataRes, profile] = await Promise.all([
      fetchSnapshot(),
      fetchAllNews(),
      fetch(`${origin}/api/market-data`).then(r => r.json()).catch(() => ({})),
      getProfile(),
    ]);

    const md = marketDataRes as { fg?: number | string; vix?: number; skew?: number; yield?: number };
    const extrasBlock = `F&G ${md.fg ?? '--'} / VIX ${md.vix ?? '--'} / Skew ${md.skew ?? '--'} / US10Y ${md.yield ?? '--'}%`;

    const prompt = buildMorningPrompt({
      indicatorsBlock: formatSnapshot(snap),
      extrasBlock,
      newsBlock: formatNews(news),
      holdings: profile.holdings,
    });

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const body = msg.content
      .filter(b => b.type === 'text')
      .map(b => (b.type === 'text' ? b.text : ''))
      .join('');

    const slackText = `🌅 *${dateLabel} Morning Briefing*\n\n${body}\n\n📈 <${origin}/|Daily Briefing>`;
    await sendSlack(slackText);

    return NextResponse.json({ ok: true, dateLabel, bodyLength: body.length, newsCount: news.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sendSlack(`⚠️ Morning Briefing 生成失敗 (${dateLabel}): ${message.slice(0, 200)}`);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: ビルド確認**

実行: `npm run build`
期待: 成功、`/api/cron/morning-summary` がルート一覧に表示される。

- [ ] **Step 3: 手動 smoke test（ローカル）**

実行:
```
set -a; source .env.local; set +a
npm run dev &
sleep 6
curl -s http://localhost:3000/api/cron/morning-summary
```
期待:
- `{"ok":true,"dateLabel":"2026/...","bodyLength":N,"newsCount":M}`
- Slack `#market-db-alerts` に🌅から始まる投稿が届く

失敗時の確認:
- `bodyLength` が 0 → Claude が空文字を返した可能性。プロンプト確認。
- `newsCount` が 0 → Yahoo/Reuters どちらもダメ。手動で curl して切り分け。
- 500 → エラーメッセージ確認、Slack にも警告投稿が届くはず。

dev server を kill。

- [ ] **Step 4: コミット**

実行:
```
git add src/app/api/cron/morning-summary/route.ts
git commit -m "feat: add morning summary cron route with Slack delivery"
```

---

## Phase F: 本番デプロイ + 検証

### Task F.1: push してデプロイ

- [ ] **Step 1: lint と test 最終確認**

実行:
```
npm run lint
npm test
npm run build
```
期待:
- lint: 既存3件以外は新規警告なし
- test: 34 passing
- build: 成功

- [ ] **Step 2: push**

実行: `git push`

- [ ] **Step 3: Vercel デプロイ完了を待つ**

実行:
```
TOKEN=$(cat ~/.claude/secrets/vercel-token)
until STATE=$(curl -s -H "Authorization: Bearer $TOKEN" "https://api.vercel.com/v6/deployments?projectId=market-db&limit=1" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).deployments[0].state)})") && [ "$STATE" = "READY" -o "$STATE" = "ERROR" -o "$STATE" = "CANCELED" ]; do sleep 10; done
echo "Final state: $STATE"
```

期待: `Final state: READY`。

- [ ] **Step 4: 本番 cron を手動発火して動作確認**

実行:
```
curl -s -w "\nHTTP %{http_code}\n" "https://market-db-five.vercel.app/api/cron/morning-summary"
```
期待:
- HTTP 200 + `{"ok":true,...}`
- Slack `#market-db-alerts` に Morning Briefing 投稿が届く
- 投稿内容が「📊 振り返り / 🔮 今日 / 💡 持ち株」の3セクション構成、全体短くキレ味あり

失敗時:
- 500 → Slack に⚠️警告投稿が届くはず → そのメッセージで切り分け
- 投稿来ない → Vercel ダッシュボード→Logs→Functions で `/api/cron/morning-summary` の実行ログ確認

### Task F.2: 翌朝5:30 JST の自動配信を観察

- [ ] **Step 1: holdings を実値で設定**

ブラウザで `https://market-db-five.vercel.app/` を開き、Profile パネルの Holdings textarea に実保有を入力。

- [ ] **Step 2: 翌朝5:30 JST に Slack を確認**

Slack `#market-db-alerts` に自動投稿が届いていれば完了。

## 完了基準

- 全 Phase の commit が main にマージ済み・Vercel デプロイ READY
- 手動 curl で Slack に Morning Briefing が配信される
- 翌朝5:30 JST に自動配信が走り、Slack で確認できる
- ProfilePanel の Holdings textarea で値を編集 → KV 永続化 → 翌朝の Briefing にその内容が反映される
