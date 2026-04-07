"use client";

import React, { useState, useEffect } from 'react';
import { Gauge, Flame, TrendingDown, Cpu, ShieldCheck, Wallet, BrainCircuit, History, Loader2 } from 'lucide-react';

const portfolioData = [
  { 
      id: "core", 
      category: "Core Engine (土台) - 全世界株・全米株", 
      items: [
          "VT (トータル・ワールド・ストック)", "eMAXIS / 楽天+ 全世界株式 (オルカン)", "楽天・VXUS (除く米国)", 
          "LOSA 国際分散インデックス", 
          "eMAXIS / 楽天+ S&P500", "楽天・VTI (全米株式)", "米国株式これ1本"
      ],
      strategy: {
          HEAT: { budget: "10万円/月", action: "eMAXIS・楽天投信の自動積立（クレカ等）のみ最低限で継続。ETFの直接買付は停止し、相場転換を待つ。" },
          PERFECT: { budget: "10万円/月 (+ Pool全解放)", action: "<div class='bg-black/40 rounded p-2 mb-2 text-xs border border-emerald-500/30'><div class='text-[10px] text-emerald-400 mb-1 font-black'>【全力買付銘柄別スプリット】</div><ul class='space-y-1 opacity-90 pl-1'><li><span class='text-indigo-400'>・</span> オルカン投信: <b class='font-mono'>5.0万円</b></li><li><span class='text-indigo-400'>・</span> S&P500投信: <b class='font-mono'>5.0万円</b></li><li><span class='text-amber-400 font-bold'>・ Pool資金(全力)</span> → VT / VTI へ成行一括</li></ul></div>予算はあえてレバレッジやGrowthへ強く傾斜させる。しかし待機資金(Pool)を一気に解き放ち、VT・S&P500を大量にスポット買いする絶好機。" },
          HIGH: { budget: "15万円/月", action: "<div class='bg-black/40 rounded p-2 mb-2 text-xs border border-emerald-500/30'><div class='text-[10px] text-emerald-400 mb-1 font-black'>【押し目買い銘柄別スプリット】</div><ul class='space-y-1 opacity-90 pl-1'><li><span class='text-indigo-400'>・</span> オルカン投信: <b class='font-mono'>7.5万円</b></li><li><span class='text-indigo-400'>・</span> S&P500投信: <b class='font-mono'>5.0万円</b></li><li><span class='text-indigo-400'>・</span> VT または VTI: <b class='font-mono'>2.5万円</b> (スポット)</li></ul></div>投信の自動積立は継続しつつ、VTIやVT、eMAXIS S&P500の押し目を丁寧に拾い、中長期目線でスポット購入を積極化。" },
          WATCH: { budget: "15万円/月", action: "下落の入り口の可能性。ETFの指値買いは控えるが、毎月の投信自動積立は金額を落とさず着実に継続。" },
          NEUTRAL: { budget: "20万円/月", action: "eMAXIS/楽天のオルカン・S&P500投信に合算で月15万〜20万円を自動積立。余力があればVTを下落日に指値買い。" }
      }
  },
  {
      id: "growth",
      category: "Growth Alpha (成長/テック) - NASDAQ・FANG+",
      items: [
          "QQQ", "ニッセイ / 楽天+ / iFreeNEXT NASDAQ100", 
          "iFreeNEXT FANG+", "ニッセイメガ10", "ニッセイSOX指数 (半導体)"
      ],
      strategy: {
          HEAT: { budget: "0円/月", action: "新規買付だけは完全停止。相場が急落するリスクが高いため、QQQやSOX等のETFは一部利益確定（リバランス）を強く推奨。" },
          PERFECT: { budget: "25万円/月", action: "<div class='bg-black/40 rounded p-2 mb-2 text-xs border border-emerald-500/30'><div class='text-[10px] text-emerald-400 mb-1 font-black'>【全力買付銘柄別スプリット】</div><ul class='space-y-1 opacity-90 pl-1'><li><span class='text-indigo-400'>・</span> QQQ (ETF): <b class='font-mono'>15.0万円</b></li><li><span class='text-indigo-400'>・</span> FANG+投信: <b class='font-mono'>5.0万円</b></li><li><span class='text-indigo-400'>・</span> SOX指数投信: <b class='font-mono'>5.0万円</b></li></ul></div>最強のバーゲンセール。QQQ、FANG+、SOX指数を中心に毎月予算の半分を集中投下。将来の超過収益のため全力で買う。" },
          HIGH: { budget: "20万円/月", action: "<div class='bg-black/40 rounded p-2 mb-2 text-xs border border-emerald-500/30'><div class='text-[10px] text-emerald-400 mb-1 font-black'>【押し目買い銘柄別スプリット】</div><ul class='space-y-1 opacity-90 pl-1'><li><span class='text-indigo-400'>・</span> QQQ (ETF): <b class='font-mono'>10.0万円</b> (スポット)</li><li><span class='text-indigo-400'>・</span> NASDAQ100投信: <b class='font-mono'>5.0万円</b></li><li><span class='text-indigo-400'>・</span> FANG+投信: <b class='font-mono'>2.5万円</b></li><li><span class='text-indigo-400'>・</span> SOX指数投信: <b class='font-mono'>2.5万円</b></li></ul></div>ボラティリティを味方につけ、NASDAQ等へ強気に予算を振り向ける。急落した日は迷わずQQQをスポット買い。" },
          WATCH: { budget: "5万円/月", action: "大きく下がるまで資金を温存。「どうしても買いたい」場合、ニッセイNASDAQ100などの投信を少額（日中下落時）のみ買う。" },
          NEUTRAL: { budget: "10万円/月", action: "ニッセイNASDAQ100や楽天+NASDAQ100投信へ月8万円程度を自動積立。残り2万円でFANG+やSOX指数を調整幅に応じて買う。" }
      }
  },
  {
      id: "value",
      category: "Income (高配当/インカム) - 増配株・BDC",
      items: [
          "VIG (増配ETF)", "楽天・VYM / 楽天・SCHD / 米国株式配当貴族", "楽天・JEPQ", 
          "豪州高配当 / 豪州利回り(豪州力) / 豪州リート", "米国BDCファンド"
      ],
      strategy: {
          HEAT: { budget: "15万円/月", action: "グロースからの資金退避先としてバリューや高配当が有効。VIGやSCHD、豪州高配当等へ手厚く配分し、得られた配当は全てプールへ。" },
          PERFECT: { budget: "0円/月 (配当再投資)", action: "新規予算はリターンの高いGrowthやLeverageへ回すため一旦ストップ。ただし、得られた配当金はそのままJEPQやVYMへ再投資。" },
          HIGH: { budget: "5万円/月", action: "<div class='bg-black/40 rounded p-2 mb-2 text-xs border border-emerald-500/30'><div class='text-[10px] text-emerald-400 mb-1 font-black'>【押し目買い銘柄別スプリット】</div><ul class='space-y-1 opacity-90 pl-1'><li><span class='text-indigo-400'>・</span> VIG (増配ETF): <b class='font-mono'>3.0万円</b></li><li><span class='text-indigo-400'>・</span> VYM または SCHD: <b class='font-mono'>2.0万円</b></li></ul></div>優良配当株の利回りが魅力的な水準。VIGやVYMを中心に、相場下落に強い「米国株式配当貴族」などを押し目拾い。" },
          WATCH: { budget: "10万円/月", action: "下落相場に強い増配 ETF(VIG)やSCHDをメインに据える。米国BDCファンドなどの利回り妙味ある銘柄も一部拾う。" },
          NEUTRAL: { budget: "10万円/月", action: "楽天・VYM、楽天・SCHD、VIGなどへ満遍なく積立・スポット購入し、配当を生み出すキャッシュ・マシンを着実に育成。" }
      }
  },
  {
      id: "defensive",
      category: "Defensive & Sector (防御/セクター)",
      items: [
          "VHT / IXJ (ヘルスケア)", "ITA (航空宇宙防衛)"
      ],
      strategy: {
          HEAT: { budget: "5万円/月", action: "急落リスクに備え、ポートフォリオの防御力強化のためVHT（ヘルスケア）やITA（防衛）をコアに組込む。" },
          PERFECT: { budget: "0円/月", action: "今はディフェンシブを買う時ではなく、徹底的に攻める場面。既存保有分はそのままホールドし、新規資金はゼロ。" },
          HIGH: { budget: "0円/月", action: "<div class='bg-black/40 rounded p-2 mb-2 text-[11px] border border-slate-500/30 text-slate-400 font-bold'>【推奨アクション】 新規買付なし (グロースへ集中)</div>セクターローテーションを意識しつつも、よりリターンの期待できるGrowth系へ予算を優先して投下するためスキップ。" },
          WATCH: { budget: "3万円/月", action: "相場の不透明感に備え、ヘルスケア(VHT)や航空宇宙(ITA)へ少しずつ資金を移し、ポートフォリオの安定を図る。" },
          NEUTRAL: { budget: "2万円/月", action: "サテライト枠として、VHTとITAをそれぞれ月1万円ずつ、もしくは下落したタイミングでETFを拾う。" }
      }
  },
  {
      id: "emerging",
      category: "Global & Commodities (海外等資源)",
      items: [
          "iTrust インド株式", "EFA (米国外先進国)", "オーストラリア株式ファンド", "BHP / RIO"
      ],
      strategy: {
          HEAT: { budget: "0円/月", action: "新興国や資源のモメンタムがピークの場合、BHPやRIO、インド株での利益確定を検討し、待機資金(Pool)へ移す。" },
          PERFECT: { budget: "0円/月", action: "米国株のバーゲンセール中であるため、米国成長株・レバレッジを優先させる。新興国への新規投資は停止。" },
          HIGH: { budget: "0円/月", action: "<div class='bg-black/40 rounded p-2 mb-2 text-[11px] border border-slate-500/30 text-slate-400 font-bold'>【推奨アクション】 新規買付なし (米国株押し目へ集中)</div>ドル安反転など成長シナリオが明確なインド株は長期で期待できるが、今は米国株の強気な押し目買いを優先する。" },
          WATCH: { budget: "2万円/月", action: "米国一本足打法のリスクを減らすため、iTrustインド株式やEFAへ少額ずつ分散投資し仕込みリスクを低減する。" },
          NEUTRAL: { budget: "3万円/月", action: "ポートフォリオのスパイスとして、インド株式と豪州株式を中心に定額積立を継続し、成長の種をまく。" }
      }
  },
  {
      id: "hedge",
      category: "Hedge (実物資産等) - 金・銀など",
      items: [
          "IAU / GLDM (ゴールドETF)", "SLV (シルバーETF)", "金・銀・プラチナ (積立/現物)"
      ],
      strategy: {
          HEAT: { budget: "5万円/月", action: "インフレヘッジ・リスクオフの受け皿として重要性が増す。IAUやGLDM、現物積立を増額して有事のクッションにする。" },
          PERFECT: { budget: "0円/月", action: "「Cash is King」の暴落時など流動性枯渇に巻き込まれて金も下がることがあるが、新規予算は株式の大底拾いに使う。" },
          HIGH: { budget: "0円/月", action: "<div class='bg-black/40 rounded p-2 mb-2 text-[11px] border border-slate-500/30 text-slate-400 font-bold'>【推奨アクション】 新規買付なし (株式へ資金集中)</div>実質金利低下などマクロ的理由が無い限り、リスク資産のアウトパフォームを見込めるため追加購入はストップ。" },
          WATCH: { budget: "5万円/月", action: "株式市場の不透明感増大に備え、金・銀（GLDM/SLV）やプラチナへの安全資産逃避を定額で進める。" },
          NEUTRAL: { budget: "2万円/月", action: "ポートフォリオの5-10%を維持する目的で、純金積立やGLDMを毎月一定額で買い続ける「保険」枠。" }
      }
  },
  {
      id: "leverage",
      category: "Leverage (レバレッジ) - 3倍ブル",
      items: [
          "SPXL (S&P500 3倍)", "TQQQ (NASDAQ 3倍)", "NASDAQ100 3倍ブル"
      ],
      strategy: {
          HEAT: { budget: "0円/月", action: "急落のダメージ（減価）が致命傷となるため絶対手出し無用。直ちに全決済し、利確して現金に換えることを最優先。" },
          PERFECT: { budget: "15万円/月", action: "<div class='bg-black/40 rounded p-2 mb-2 text-xs border border-emerald-500/30'><div class='text-[10px] text-emerald-400 mb-1 font-black'>【全力買付銘柄別スプリット】</div><ul class='space-y-1 opacity-90 pl-1'><li><span class='text-indigo-400'>・</span> TQQQ: <b class='font-mono'>10.0万円</b></li><li><span class='text-indigo-400'>・</span> SPXL: <b class='font-mono'>5.0万円</b></li></ul></div>VIXダウンと総悲観からの反発を狙う、ハイリスク・ハイリターンの絶好の買い場。短期決戦で集中投下。" },
          HIGH: { budget: "10万円/月", action: "<div class='bg-black/40 rounded p-2 mb-2 text-xs border border-emerald-500/30'><div class='text-[10px] text-emerald-400 mb-1 font-black'>【押し目買い銘柄別スプリット】</div><ul class='space-y-1 opacity-90 pl-1'><li><span class='text-indigo-400'>・</span> TQQQ: <b class='font-mono'>5.0万円</b></li><li><span class='text-indigo-400'>・</span> SPXL: <b class='font-mono'>5.0万円</b></li></ul></div>明確な底打ちシグナルが発生した場合のみ、指値を厳格に設定した上で、TQQQやSPXLの打診買い・買い増し。" },
          WATCH: { budget: "0円/月", action: "ボラティリティが高く値動きが荒い局面では、横ばいや下落で著しい減価が進んでしまうため、一切購入しない。" },
          NEUTRAL: { budget: "0円/月", action: "レンジ相場ではレバレッジの減価特性によりジリ貧となる。通常時は一切予算を割かず、次の暴落を待つ。" }
      }
  },
  {
      id: "pool",
      category: "Safe Assets (債券/待機資金)",
      items: [
          "eMAXIS Slim 国内債券", "SBI 全世界債券", "米ドル外貨預金"
      ],
      strategy: {
          HEAT: { budget: "15万円/月", action: "次の暴落に備えた「資金プール」の構築を強力に推進。米国株で利確した資金も合流させ、現金・債券を厚く積む。" },
          PERFECT: { budget: "0円/月 (全額放出)", action: "<div class='bg-red-900/30 rounded p-2 mb-2 text-xs border border-red-500/30'><span class='text-red-400 font-black'>【資金大放出アラート!!】</span><br>プールへの入金はゼロ。むしろこれまで貯めた債券を売り、待機資金を全開にして株式市場(Core等)へ投下せよ。</div>株を買う千載一遇のチャンス。" },
          HIGH: { budget: "0円/月", action: "<div class='bg-slate-800 rounded p-2 mb-2 text-[11px] border border-slate-500/30 text-slate-300 font-bold'>【推奨アクション】 新規プールなし (一部を株へ移行)</div>高確率で勝てる局面においてはプール蓄積は行わず、すでにあるプール資金を徐々に株式の「積極投資」枠へ移行させる。" },
          WATCH: { budget: "10万円/月", action: "大きな下落(PERFECT)が来た時に即座に動けるよう、予算の20%を現預金や短期債券に回し、買い向かうための弾薬を貯蓄する。" },
          NEUTRAL: { budget: "3万円/月", action: "生活資金とは別に、常に証券口座内に「暴落時に使える弾薬」としての米ドルや債券を毎月少しずつ貯めておく。" }
      }
  }
];

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
  const [status, setStatus] = useState("NEUTRAL");
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
        setStrategyMessage("自動データ取得完了。数値を手動で修正できます。「この数値で確定・AI分析開始」ボタンを押してください。");
      } catch (err) {
        console.error("Failed to fetch market data", err);
        setStrategyMessage("データ取得失敗。手動で数値を入力してください。");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleAnalyze = async () => {
    if (!data.fg || !data.vix || !data.skew || data.fg === "--" || data.vix === "--.--" || data.skew === "---") {
      alert("全ての数値を入力・確認してから確定ボタンを押してください。");
      return;
    }

    setStrategyMessage("データ取得完了。AI戦術分析に移行します...");
    setIsAnalyzing(true);
    
    // Calculate status
    const fgVal = parseFloat(data.fg);
    const vixVal = parseFloat(data.vix);
    const skewVal = parseFloat(data.skew);
    
    const buySignals = [
      { name: 'F&G', active: fgVal <= 30 },
      { name: 'VIX', active: vixVal >= 28 },
      { name: 'Skew', active: skewVal <= 118 }
    ];
    
    const actCount = buySignals.filter(s => s.active).length;
    const isHeat = fgVal >= 75;

    let newStatus = "NEUTRAL";
    if (isHeat) newStatus = "HEAT";
    else if (actCount === 3) newStatus = "PERFECT";
    else if (actCount >= 2) newStatus = "HIGH";
    else if (actCount === 1) newStatus = "WATCH";

    setStatus(newStatus);
    
    // Fetch AI insight
    try {
      const res = await fetch('/api/alpha-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fg: fgVal, vix: vixVal, skew: skewVal })
      });
      const json = await res.json();
      setAiInsight(json.insight || 'AI分析の取得に失敗しました。');
    } catch (err) {
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

        {/* UNIFIED INPUT AREA */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card rounded-3xl p-8 flex flex-col items-center justify-center space-y-4">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Gauge className="w-4 h-4" /> Fear & Greed</h2>
              <input type="number" placeholder={isLoading ? "Loading..." : "--"} value={data.fg} onChange={(e) => setData({...data, fg: e.target.value})} className="input-tactical w-full py-10 text-6xl shadow-inner" />
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Enter Score (0-100)</p>
            </div>
            <div className="glass-card rounded-3xl p-8 flex flex-col items-center justify-center space-y-4">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Flame className="w-4 h-4" /> VIX Index</h2>
              <input type="number" step="0.01" placeholder={isLoading ? "Loading..." : "--.--"} value={data.vix} onChange={(e) => setData({...data, vix: e.target.value})} className="input-tactical w-full py-10 text-6xl shadow-inner" />
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Enter Value (e.g. 25.24)</p>
            </div>
            <div className="glass-card rounded-3xl p-8 flex flex-col items-center justify-center space-y-4">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><TrendingDown className="w-4 h-4" /> Skew Index</h2>
              <input type="number" placeholder={isLoading ? "Loading..." : "---"} value={data.skew} onChange={(e) => setData({...data, skew: e.target.value})} className="input-tactical w-full py-10 text-6xl shadow-inner" />
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Enter Index (e.g. 145)</p>
            </div>
          </div>

          <div className="flex justify-center mt-6 pt-4">
            <button onClick={handleAnalyze} className="btn-master bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-4 rounded-full shadow-[0_0_20px_rgba(79,70,229,0.5)] border border-indigo-400/50 flex items-center gap-3 w-full md:w-auto text-sm md:text-base">
              <Cpu className="w-5 h-5" />
              この数値で確定・AI分析開始
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

                const strat = cat.strategy ? cat.strategy[status as keyof typeof cat.strategy] || cat.strategy["NEUTRAL"] : { budget: "--", action: "定期積立を継続し、相場変動を静観。" };

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

      {/* HISTORICAL TACTICAL DATA */}
      <div className="max-w-7xl mx-auto pb-24">
        <h2 className="text-sm font-black text-slate-500 uppercase tracking-[0.3em] mb-6 pl-2 flex items-center gap-3">
          <History className="w-4 h-4" /> Historical Tactical Data (Bottom Analysis)
        </h2>
        <div className="glass-card rounded-3xl overflow-hidden shadow-2xl border border-white/5 overflow-y-auto max-h-[500px]">
          <table className="w-full history-table border-collapse min-w-[800px]">
            <thead><tr className="bg-slate-900/80"><th>Date (Bottom)</th><th>Intensity</th><th>F&G Score</th><th>VIX Peak</th><th>Market Context</th></tr></thead>
            <tbody className="text-slate-300">
              <tr className="history-row"><td>2024-08-05</td><td><span className="status-badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/50">3/3 PERFECT</span></td><td className="font-mono text-emerald-400">17</td><td className="font-mono">38.5</td><td>植田ショック。最強の反発起点。</td></tr>
              <tr className="history-row"><td>2024-04-19</td><td><span className="status-badge bg-indigo-500/20 text-indigo-400 border border-indigo-500/50">2/3 HIGH PROB</span></td><td className="font-mono text-indigo-400">31</td><td className="font-mono">21.2</td><td>テック株調整。半導体押し目。</td></tr>
              <tr className="history-row"><td>2022-10-13</td><td><span className="status-badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/50">3/3 PERFECT</span></td><td className="font-mono text-emerald-400">15</td><td className="font-mono">33.8</td><td>CPIパニック。インフレ懸念。</td></tr>
              <tr className="history-row"><td>2020-03-23</td><td><span className="status-badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/50">3/3 PERFECT</span></td><td className="font-mono text-emerald-400">2</td><td className="font-mono">82.7</td><td>コロナ。史上最大の投げ売り。</td></tr>
              <tr className="history-row"><td>2018-12-24</td><td><span className="status-badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/50">3/3 PERFECT</span></td><td className="font-mono text-emerald-400">5</td><td className="font-mono">36.1</td><td>クリスマスイブ。パウエル発言。</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
