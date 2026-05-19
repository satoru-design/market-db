export type Phase = "HEAT" | "PERFECT" | "HIGH" | "WATCH" | "NEUTRAL";
export type StrategyEntry = { budget: string; action: string };
export type PortfolioCategory = {
  id: string;
  category: string;
  items: string[];
  strategy: Record<Phase, StrategyEntry>;
};

export const portfolioData: PortfolioCategory[] = [
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
