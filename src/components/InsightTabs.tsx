"use client";
import { useEffect, useState } from 'react';
import { Loader2, BrainCircuit } from 'lucide-react';

type Tab = 'claude' | 'gemini';

export function InsightTabs({ indicators }: { indicators: { fg: number; vix: number; skew: number } | null }) {
  const [active, setActive] = useState<Tab>('claude');
  const [texts, setTexts] = useState<Record<Tab, string>>({ claude: '', gemini: '' });
  const [loading, setLoading] = useState<Record<Tab, boolean>>({ claude: false, gemini: false });

  useEffect(() => {
    if (!indicators) return;
    const fetchInsight = async (tab: Tab) => {
      setLoading(l => ({ ...l, [tab]: true }));
      try {
        const res = await fetch(`/api/insight/${tab}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(indicators),
        });
        const json = await res.json();
        setTexts(t => ({ ...t, [tab]: json.insight || 'エラー' }));
      } catch {
        setTexts(t => ({ ...t, [tab]: 'ネットワークエラー' }));
      } finally {
        setLoading(l => ({ ...l, [tab]: false }));
      }
    };
    fetchInsight('claude');
    fetchInsight('gemini');
  }, [indicators?.fg, indicators?.vix, indicators?.skew]);

  return (
    <div className="glass-card rounded-3xl p-8 border-l-8 border-l-indigo-600">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-black text-indigo-400 uppercase tracking-[0.3em] flex items-center gap-3">
          <BrainCircuit className="w-4 h-4" /> AI Briefing
        </h2>
        <div className="flex gap-2">
          {(['claude', 'gemini'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setActive(t)}
              className={`px-3 py-1 rounded text-xs font-black uppercase tracking-wider ${active === t ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="text-base text-slate-200 font-bold italic leading-relaxed min-h-[80px]">
        {loading[active] ? (
          <div className="flex items-center gap-3 text-indigo-400">
            <Loader2 className="animate-spin w-5 h-5" />
            {active} 分析中...
          </div>
        ) : texts[active] || '指標取得待ち'}
      </div>
    </div>
  );
}
