"use client";

import { useEffect, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import type { Profile } from '@/lib/profile';
import type { Phase } from '@/lib/signals';
import { DEPLOY } from '@/lib/buy-action';
import { MONEY_MAX } from '@/lib/profile-patch';
import { tranchesFor } from '@/lib/share-plan';
import { SharePlan } from './SharePlan';

// 弾薬（暴落時に使う待機資金）を書き換える。
// Slack の通知はこの額 × フェーズの割合で「いくら買うか」を出すので、買ったら直す。
// 2026-11-21 追加。保存は「保存」を押した時に1回だけ送る（打つたびに送らない）。

type Load = 'loading' | 'error' | 'ready';
type Save = 'idle' | 'saving' | 'saved' | 'failed';

const yen = (n: number) => `${n.toLocaleString('ja-JP')}円`;

// 「434,000」「434000円」「４３４０００」を受ける。読めなければ null。
function parseYen(text: string): number | null {
  const half = text.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const digits = half.replace(/[,，\s円]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

function formatWhen(iso: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function CashPoolPanel({ phase, fg }: { phase: Phase | null; fg: number | null }) {
  const [load, setLoad] = useState<Load>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [text, setText] = useState('');
  const [save, setSave] = useState<Save>('idle');
  const [saveError, setSaveError] = useState('');

  const fetchProfile = async () => {
    setLoad('loading');
    try {
      const res = await fetch('/api/profile');
      if (!res.ok) throw new Error(String(res.status));
      const p = (await res.json()) as Profile;
      setProfile(p);
      setText(p.cashPool.toLocaleString('ja-JP'));
      setLoad('ready');
    } catch {
      setLoad('error');
    }
  };

  useEffect(() => { fetchProfile(); }, []);

  const value = parseYen(text);
  const unchanged = profile !== null && value === profile.cashPool;

  let blocked: string | null = null;
  if (load === 'loading') blocked = '今の弾薬を読み込んでいます。';
  else if (load === 'error') blocked = '今の弾薬が読めませんでした。「読み直す」を押してください。';
  else if (value === null) blocked = '数字で入れてください（例: 390,600）。';
  else if (value > MONEY_MAX) blocked = '桁が多すぎます。打ち間違いがないか見てください。';
  else if (unchanged) blocked = '今の額と同じです。額を変えると保存できます。';
  else if (save === 'saving') blocked = '保存しています。';

  const onSave = async () => {
    if (blocked || value === null) return;
    setSave('saving');
    setSaveError('');
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashPool: value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '保存できませんでした');
      setProfile(json as Profile);
      setText((json as Profile).cashPool.toLocaleString('ja-JP'));
      setSave('saved');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '保存できませんでした');
      setSave('failed');
    }
  };

  // 今のフェーズなら、この額からいくら出すか（通知と同じ DEPLOY から出す）。
  const base = value ?? profile?.cashPool ?? null;
  let preview: string;
  if (!phase || base === null) {
    preview = 'フェーズが揃うと、この額から今いくら出すかをここに出します。';
  } else {
    const r = DEPLOY[phase];
    const out = Math.round(base * (r.core + r.leverage));
    // 「1回いくらを何回」まで書く（総額と1回分を取り違えないように）。
    const tr = tranchesFor(phase, base, fg);
    const steps = tr
      .map(t => {
        const who = t.kind === 'leverage' ? '3倍ブルは' : tr.length > 1 ? '主力・守り・戻りは' : '';
        return t.times > 1
          ? `${who}1回${yen(t.budgetYen)}ずつ${t.times}回に分けて買います。`
          : `${who}${yen(t.budgetYen)}を一括で買います。`;
      })
      .join('');
    preview = out > 0
      ? `今は${phase}なので、この額の${Math.round((r.core + r.leverage) * 100)}%＝${yen(out)}を使います。${steps}${r.core + r.leverage < 1 ? `残りの${yen(base - out)}は、さらに下げた時のために取っておきます。` : ''}`
      : `今は${phase}なので、弾薬からは出しません。`;
  }

  const when = profile ? formatWhen(profile.cashPoolUpdatedAt) : null;

  return (
    <section className="glass-card rounded-3xl p-5 sm:p-8 border-l-8 border-l-amber-500" data-testid="cash-pool-panel">
      {/* 2026-11-21 小池: 今買うもの（株数）を先に、弾薬の入力はその下に置く。 */}
      <h2 className="text-sm font-black text-amber-400 tracking-[0.2em] flex items-center gap-3 mb-3">
        <ShoppingCart className="w-4 h-4" /> 今買うもの
      </h2>
      <SharePlan cashPool={base} phase={phase} fg={fg} />

      <div className="mt-6 pt-6 border-t border-slate-700">
        <h3 className="text-sm font-black text-amber-300 mb-2">弾薬</h3>
        <p className="text-base text-slate-100 font-bold mb-1">
          {load === 'ready' && profile
            ? `今の弾薬は${yen(profile.cashPool)}です。${when ? `（${when}に保存）` : '（保存した日時の記録はまだありません）'}`
            : load === 'loading' ? '今の弾薬を読み込んでいます。' : '今の弾薬が読めませんでした。'}
        </p>
        {/* 2026-11-21 小池「弾薬って5日間合計の金額をいれるんですか？」→ 総額だと分かる文に直した。 */}
        <div className="text-sm text-slate-300 mb-5 space-y-1">
          <p><span className="font-bold text-white">暴落の時に株へ回してよい現金の総額</span>を入れます。1回に買う額でも、何日分かの合計でもありません。</p>
          <p className="text-slate-400">1回に買う額は、フェーズに合わせてこの総額から計算します。買ったら、使った分を引いた額に書き直してください。そのままだと次の回も同じ額で計算します。</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <label className="block flex-1">
            <span className="text-xs text-slate-400 font-bold block mb-1">新しい弾薬（円）</span>
            <input
              type="text"
              inputMode="numeric"
              value={text}
              disabled={load !== 'ready'}
              onChange={e => { setText(e.target.value); if (save !== 'saving') setSave('idle'); }}
              onKeyDown={e => { if (e.key === 'Enter') onSave(); }}
              placeholder="例: 390,600"
              className="w-full bg-black/40 border border-slate-700 rounded-lg px-4 py-3 text-white font-mono text-xl disabled:opacity-50"
            />
          </label>
          <button
            type="button"
            onClick={onSave}
            disabled={blocked !== null}
            title={blocked ?? '弾薬をこの額で保存します'}
            className="px-6 py-3 rounded-lg font-black text-sm bg-amber-500 text-black hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            {save === 'saving' ? '保存しています' : '弾薬を保存'}
          </button>
          {load === 'error' && (
            <button type="button" onClick={fetchProfile} className="px-4 py-3 rounded-lg text-sm font-bold border border-slate-600 text-slate-200">
              読み直す
            </button>
          )}
        </div>

        <p className="text-sm mt-3 min-h-[1.25rem]" data-testid="cash-pool-status">
          {save === 'saved' && <span className="text-emerald-400 font-bold">保存しました。次の通知からこの額で計算します。</span>}
          {save === 'failed' && <span className="text-red-400 font-bold">保存できませんでした（{saveError}）。額はまだ前のままです。</span>}
          {(save === 'idle' || save === 'saving') && blocked && <span className="text-slate-500">{blocked}</span>}
          {save === 'idle' && !blocked && value !== null && <span className="text-slate-300">「弾薬を保存」を押すと{yen(value)}に変わります。</span>}
        </p>
        <p className="text-sm text-slate-400 mt-1">{preview}</p>
      </div>
    </section>
  );
}
