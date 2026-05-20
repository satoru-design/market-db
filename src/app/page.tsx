"use client";

import React, { useState, useEffect } from 'react';
import { Gauge, Flame, TrendingDown, Cpu, ShieldCheck, Wallet, BrainCircuit, History, Loader2 } from 'lucide-react';
import { portfolioData } from '@/data/portfolio';
import { detectPhase, type Phase } from '@/lib/signals';
import { ScenarioCards } from '@/components/ScenarioCards';
import { BacktestPanel } from '@/components/BacktestPanel';
import { ProfilePanel } from '@/components/ProfilePanel';

interface MarketData {
  fg: string;
  vix: string;
  skew: string;
  yield: number | null;
  dxy: number | null;
  gold: number | null;
  silver: number | null;
}

export default function TerminalPage() {
  const [data, setData] = useState<MarketData>({
    fg: '', vix: '', skew: '', yield: null, dxy: null, gold: null, silver: null
  });
  const [status, setStatus] = useState<Phase>("NEUTRAL");
  const [strategyMessage, setStrategyMessage] = useState("データ取得中です...");
  const [aiInsight, setAiInsight] = useState("データ取得完了後、AIが市場を統合スキャンします。");
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/market-data');
        const json = await res.json();
        
        if (json.error) {
          throw new Error(json.error);
        }
        
        setData({
          fg: json.fg ? json.fg.toString() : '',
          vix: json.vix ? json.vix.toFixed(2) : '',
          skew: json.skew ? json.skew.toFixed(2) : '',
          yield: json.yield,
          dxy: json.dxy,
          gold: json.gold,
          silver: json.silver
        });
        setStrategyMessage("自動データ取得完了。AI Briefing を更新して市場フェーズを確認してください。");

        const fgN = parseFloat(json.fg);
        const vixN = parseFloat(json.vix);
        const skewN = parseFloat(json.skew);
        if (!Number.isNaN(fgN) && !Number.isNaN(vixN) && !Number.isNaN(skewN)) {
          setStatus(detectPhase({ fg: fgN, vix: vixN, skew: skewN }));
        }
      } catch (err) {
        console.error("Failed to fetch market data", err);
        setStrategyMessage("データ取得失敗。しばらく待ってリロードしてください。");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleAnalyze = async () => {
    setStrategyMessage("AI Briefing を更新中...");
    setIsAnalyzing(true);

    const fgVal = parseFloat(data.fg);
    const vixVal = parseFloat(data.vix);
    const skewVal = parseFloat(data.skew);

    if (!Number.isNaN(fgVal) && !Number.isNaN(vixVal) && !Number.isNaN(skewVal)) {
      setStatus(detectPhase({ fg: fgVal, vix: vixVal, skew: skewVal }));
    }

    // Fetch AI insight
    try {
      const res = await fetch('/api/alpha-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fg: fgVal, vix: vixVal, skew: skewVal })
      });
      const json = await res.json();
      setAiInsight(json.insight || 'AI分析の取得に失敗しました。');
    } catch {
      setAiInsight('ネットワークエラーが発生しました。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const gsRatio = (data.gold && data.silver) ? (data.gold / data.silver) : null;
  const metalTargetName = gsRatio ? (gsRatio > 85 ? "GOLD" : gsRatio < 75 ? "SILVER" : "NEUTRAL") : "--";

  const getActionCardClass = () => {
    let classes = "glass-card rounded-3xl p-8 border-l-8 transition-all duration-700 ";
    if (status === "HEAT") classes += "border-l-red-500";
    else if (status === "PERFECT") classes += "perfect-buy-glow";
    else if (status === "HIGH") classes += "high-prob-glow";
    else if (status === "WATCH") classes += "border-l-indigo-400";
    else classes += "border-l-slate-500";
    return classes;
  };

  const getBadge = () => {
    if (status === "HEAT") return <span className="recommendation-badge bg-red-600 text-white">HEAT</span>;
    if (status === "PERFECT") return <span className="recommendation-badge bg-emerald-600 text-white animate-bounce">PERFECT BUY</span>;
    if (status === "HIGH") return <span className="recommendation-badge bg-emerald-500 text-white">HIGH PROB</span>;
    if (status === "WATCH") return <span className="recommendation-badge bg-indigo-600 text-white">WATCH</span>;
    return <span className="recommendation-badge bg-slate-700 text-slate-400">NEUTRAL</span>;
  };

  const getDecisionText = () => {
    if (status === "HEAT") return "利益確定推奨";
    if (status === "PERFECT") return "全力買付";
    if (status === "HIGH") return "強気スポット買付";
    if (status === "WATCH") return "打診買い";
    return "静観";
  };

  return (
    <div className="min-h-screen p-4 sm:p-8 lg:p-12 space-y-12 pb-24 text-slate-100">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6 border-b border-white/10 pb-8">
          <div>
            <h1 className="text-3xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
              Market Risk Pro <span className="text-sm align-top text-slate-500 font-bold ml-2 tracking-[0.3em] uppercase font-black">Alpha Terminal v9.5</span>
            </h1>
            <p className="text-slate-400 text-sm md:text-lg mt-2 font-medium opacity-80 uppercase font-black tracking-widest italic">
              AI Secured Network Edition
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-right">
            <div className="text-slate-500 border border-slate-700 px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest transition-all">Secure API Gateway</div>
            <div className="text-xs text-slate-500 italic font-mono uppercase tracking-[0.1em] font-black">SYSTEM READY</div>
          </div>
        </div>

        {/* AUTO-FETCHED INDICATORS */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card rounded-3xl p-8 flex flex-col items-center justify-center space-y-4">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Gauge className="w-4 h-4" /> Fear & Greed</h2>
              <div className="text-6xl font-black text-white py-6">{data.fg || '--'}</div>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">CNN Auto-fetch</p>
            </div>
            <div className="glass-card rounded-3xl p-8 flex flex-col items-center justify-center space-y-4">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Flame className="w-4 h-4" /> VIX Index</h2>
              <div className="text-6xl font-black text-white py-6">{data.vix || '--.--'}</div>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Yahoo Finance Auto-fetch</p>
            </div>
            <div className="glass-card rounded-3xl p-8 flex flex-col items-center justify-center space-y-4">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><TrendingDown className="w-4 h-4" /> Skew Index</h2>
              <div className="text-6xl font-black text-white py-6">{data.skew || '---'}</div>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Yahoo Finance Auto-fetch</p>
            </div>
          </div>

          <div className="flex justify-center mt-6 pt-4">
            <button onClick={handleAnalyze} className="btn-master bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-4 rounded-full shadow-[0_0_20px_rgba(79,70,229,0.5)] border border-indigo-400/50 flex items-center gap-3 w-full md:w-auto text-sm md:text-base">
              <Cpu className="w-5 h-5" />
              AI Briefing を更新
            </button>
          </div>
        </div>

        {/* STRATEGY SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-12">
          <div className="glass-card rounded-3xl p-8 border-l-8 border-l-indigo-500 flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-black mb-4 flex items-center gap-3 text-indigo-100 uppercase tracking-wider"><ShieldCheck className="text-indigo-400 w-6 h-6" /> Analyst Analysis</h3>
              <div className="text-slate-300 text-sm md:text-base leading-relaxed font-bold italic">{strategyMessage}</div>
            </div>
          </div>
          <div className={getActionCardClass()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-slate-300 uppercase tracking-widest">Trading Action</h3>
              <div>{getBadge()}</div>
            </div>
            <div className="text-xl md:text-3xl font-black mb-2 text-slate-200 tracking-tighter">{getDecisionText()}</div>
            <div className="text-xs md:text-sm text-slate-400 leading-snug italic font-black uppercase opacity-60 tracking-widest">Awaiting Command...</div>
          </div>
        </div>

        {/* SCENARIO PROJECTION */}
        <div className="mt-12">
          <h2 className="text-sm font-black text-indigo-400 uppercase tracking-[0.3em] pl-2 mb-4">Scenario Projection</h2>
          <ScenarioCards current={status} />
        </div>
      </div>

      {/* PORTFOLIO TABLE */}
      <div className="max-w-7xl mx-auto space-y-6">
        <h2 className="text-sm font-black text-emerald-400 uppercase tracking-[0.3em] pl-2 flex items-center gap-3"><Wallet className="w-5 h-5" /> Portfolio Execution Strategy</h2>
        <div className="glass-card rounded-3xl overflow-hidden shadow-2xl overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead className="bg-slate-900/80 text-[10px] text-slate-500 uppercase font-black tracking-widest">
              <tr>
                <th className="p-6 w-1/6">資産区分</th>
                <th className="p-6 w-2/6">構成銘柄 (全保有銘柄)</th>
                <th className="p-6 text-center w-1/6">アクション<br /><span className="text-[8px] opacity-70">スポット投入</span></th>
                <th className="p-6 w-2/6">毎月50万円予算の買付指示・相場戦略</th>
              </tr>
            </thead>
            <tbody className="text-slate-200 text-sm">
              {status === "NEUTRAL" && !isAnalyzing && data.fg === '' ? (
                 <tr><td colSpan={4} className="p-12 text-center text-slate-500 italic font-bold uppercase opacity-40">データを取得後、AIが戦略を更新します。</td></tr>
              ) : portfolioData.map(cat => {
                let act = "HOLD", col = "bg-slate-700", pct = "0%";
                if (status === "HEAT") { 
                    if (cat.id === "pool") { act = "資金退避"; col = "bg-blue-600"; pct = "増額蓄積"; } 
                    else if (cat.id === "leverage") { act = "SELL"; col = "bg-red-600"; pct = "全決済"; }
                    else { act = "一部利確"; col = "bg-red-600"; pct = "現金化"; } 
                }
                else if (status === "PERFECT") { 
                    if (cat.id === "pool") { act = "SELL"; col = "bg-red-600"; pct = "資金大放出"; } 
                    else if (cat.id === "value" || cat.id === "defensive" || cat.id === "emerging" || cat.id === "hedge") { act = "HOLD"; col = "bg-slate-600"; pct = "購入停止"; } 
                    else { act = "STRONG BUY"; col = "bg-emerald-600"; pct = "全力投入"; } 
                }
                else if (status === "HIGH") { 
                    if (cat.id === "pool" || cat.id === "defensive" || cat.id === "emerging" || cat.id === "hedge") { act = "WAIT"; col = "bg-slate-600"; pct = "購入停止"; } 
                    else if (cat.id === "leverage") { act = "BUY"; col = "bg-emerald-500"; pct = "打診買い"; }
                    else { act = "BUY"; col = "bg-emerald-500"; pct = "積極投資"; } 
                }
                else if (status === "WATCH") { 
                    if (cat.id === "pool") { act = "蓄積"; col = "bg-blue-600"; pct = "弾薬補給"; } 
                    else if (cat.id === "leverage" || cat.id === "growth" || cat.id === "emerging") { act = "WAIT"; col = "bg-slate-600"; pct = "購入停止"; }
                    else { act = "BUY"; col = "bg-indigo-500"; pct = "少額積立"; } 
                }
                else {
                    if (cat.id === "leverage") { act = "WAIT"; col = "bg-slate-600"; pct = "手出し無用"; }
                    else { act = "HOLD"; col = "bg-slate-500"; pct = "自動積立"; }
                }

                const strat = cat.strategy ? cat.strategy[status] || cat.strategy["NEUTRAL"] : { budget: "--", action: "定期積立を継続し、相場変動を静観。" };

                return (
                  <tr key={cat.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                    <td className="p-4 md:p-6 align-top">
                      <div className="font-black text-[13px] md:text-[15px] text-indigo-300 drop-shadow-md tracking-tight mb-3">{cat.category}</div>
                      <div className="inline-flex items-center gap-2 bg-indigo-900/40 border border-indigo-500/30 px-3 py-1.5 rounded-lg text-indigo-200">
                          <span className="text-[9px] uppercase font-black tracking-widest opacity-80 whitespace-nowrap">月間予算</span>
                          <span className="font-mono font-black text-sm md:text-base text-emerald-400 tracking-wider whitespace-nowrap">{strat.budget}</span>
                      </div>
                    </td>
                    <td className="p-4 md:p-6 align-top">
                      <div className="text-[11px] md:text-[13px] text-slate-200 mt-1 leading-relaxed space-y-1.5">
                          {cat.items.map((item, idx) => <div key={idx} className="flex items-start gap-1.5"><span className="text-indigo-500 mt-[1px] opacity-70">・</span><span>{item}</span></div>)}
                      </div>
                    </td>
                    <td className="p-4 md:p-6 text-center align-top">
                      <span className={`allocation-pill ${col} inline-block mb-3 shadow-lg w-full text-[10px] md:text-xs py-2`}>{act}</span>
                      <div className="font-bold text-[10px] md:text-[11px] text-slate-400 uppercase tracking-widest">{pct}</div>
                    </td>
                    <td className="p-4 md:p-6 align-top">
                      <div className="text-[11.5px] md:text-sm text-slate-200 font-bold leading-relaxed bg-black/30 p-4 md:p-5 rounded-2xl border border-white/10 group-hover:border-indigo-500/50 transition-all shadow-inner relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/50 relative-block-indicator"></div>
                          <div className="flex items-center gap-2 mb-3 border-b border-emerald-900/50 pb-2">
                              <span className="bg-emerald-900/40 px-2.5 py-1 rounded-md text-emerald-300 font-black text-[10px] uppercase tracking-widest">MARKET PHASE: <span className="text-white ml-1">{status}</span></span>
                          </div>
                          <span className="opacity-95 leading-loose" dangerouslySetInnerHTML={{__html: strat.action}}></span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MACRO Indicators */}
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="glass-card rounded-2xl p-6 text-center"><span className="text-[10px] text-slate-500 block uppercase mb-2 font-black">US 10Y Yield</span><div className={`text-3xl font-black text-white ${isLoading ? 'loading-pulse' : ''}`}>{data.yield ? `${data.yield.toFixed(2)}%` : '--'}</div></div>
          <div className="glass-card rounded-2xl p-6 text-center"><span className="text-[10px] text-slate-500 block uppercase mb-2 font-black">Dollar Index</span><div className={`text-3xl font-black text-white ${isLoading ? 'loading-pulse' : ''}`}>{data.dxy ? data.dxy.toFixed(2) : '--'}</div></div>
          <div className="glass-card rounded-2xl p-6 text-center"><span className="text-[10px] text-slate-500 block uppercase mb-2 font-black">GS Ratio</span><div className={`text-4xl font-black text-white ${isLoading ? 'loading-pulse' : ''}`}>{gsRatio ? gsRatio.toFixed(1) : '--'}</div></div>
          <div className="glass-card rounded-2xl p-6 text-center"><span className="text-[10px] text-slate-500 block uppercase mb-2 font-black">Metal Target</span><div className="text-xl font-black text-indigo-400 uppercase tracking-tighter">{metalTargetName}</div></div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-black text-indigo-400 uppercase tracking-[0.3em] pl-2 flex items-center gap-3"><BrainCircuit className="w-4 h-4" /> AI Daily Alpha Insight</h2>
          <div className="glass-card rounded-3xl p-8 border-l-8 border-l-indigo-600 shadow-2xl">
            <div className="text-base md:text-lg text-slate-200 font-bold italic leading-relaxed">
              {isAnalyzing ? (
                <div className="flex items-center gap-3 text-indigo-400 italic">
                  <Loader2 className="animate-spin w-5 h-5" />
                  AI分析中... (市場データを精査しています)
                </div>
              ) : aiInsight}
            </div>
          </div>
        </div>
      </div>

      <BacktestPanel />

      {/* HISTORICAL TACTICAL DATA */}
      <div className="max-w-7xl mx-auto pb-24">
        <h2 className="text-sm font-black text-slate-500 uppercase tracking-[0.3em] mb-6 pl-2 flex items-center gap-3">
          <History className="w-4 h-4" /> Historical Tactical Data (Bottom Analysis)
        </h2>
        <div className="glass-card rounded-3xl overflow-hidden shadow-2xl border border-white/5 overflow-y-auto max-h-[500px]">
          <table className="w-full history-table border-collapse min-w-[800px]">
            <thead><tr className="bg-slate-900/80"><th>Date (Bottom)</th><th>Intensity</th><th>F&G Score</th><th>VIX Peak</th><th>Skew Peak</th><th>Market Context</th></tr></thead>
            <tbody className="text-slate-300">
              <tr className="history-row"><td>2024-08-05</td><td><span className="status-badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/50">3/3 PERFECT</span></td><td className="font-mono text-emerald-400">17</td><td className="font-mono text-amber-400">38.5</td><td className="font-mono text-blue-400">---</td><td>植田ショック。最強の反発起点。</td></tr>
              <tr className="history-row"><td>2024-04-19</td><td><span className="status-badge bg-indigo-500/20 text-indigo-400 border border-indigo-500/50">2/3 HIGH PROB</span></td><td className="font-mono text-indigo-400">31</td><td className="font-mono text-amber-400">21.2</td><td className="font-mono text-blue-400">---</td><td>テック株調整。半導体押し目。</td></tr>
              <tr className="history-row"><td>2022-10-13</td><td><span className="status-badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/50">3/3 PERFECT</span></td><td className="font-mono text-emerald-400">15</td><td className="font-mono text-amber-400">33.8</td><td className="font-mono text-blue-400">---</td><td>CPIパニック。インフレ懸念。</td></tr>
              <tr className="history-row"><td>2020-03-23</td><td><span className="status-badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/50">3/3 PERFECT</span></td><td className="font-mono text-emerald-400">2</td><td className="font-mono text-amber-400">82.7</td><td className="font-mono text-blue-400">---</td><td>コロナ。史上最大の投げ売り。</td></tr>
              <tr className="history-row"><td>2018-12-24</td><td><span className="status-badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/50">3/3 PERFECT</span></td><td className="font-mono text-emerald-400">5</td><td className="font-mono text-amber-400">36.1</td><td className="font-mono text-blue-400">---</td><td>クリスマスイブ。パウエル発言。</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <ProfilePanel />
    </div>
  );
}
