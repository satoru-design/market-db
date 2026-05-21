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
              placeholder={"例: SPXL 50株 平均130円\nQQQ 80株 平均380円\n純金積立 60g"}
              className="w-full bg-black/40 border border-slate-700 rounded px-3 py-2 text-white font-mono text-sm leading-relaxed"
            />
          </label>
        </div>
      )}
    </div>
  );
}
