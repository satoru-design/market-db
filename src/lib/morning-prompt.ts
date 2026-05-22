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

  return `あなたは投資戦略アナリストです。以下のデータを基に、Slack投稿用の朝のブリーフィングを日本語で出力してください。

【厳守ルール】
- 出力は **Slack mrkdwn** 形式（強調は ** ではなく単一の * を使う。例: *QQQ*）
- コードフェンス (\`\`\`) は絶対に使わない。プレーンテキストで出力
- ## や ### のMarkdown見出しは使わない（Slackではただの記号として表示される）
- 持ち株セクションは「銘柄グループごとに段落分け」する（ティッカー行 → 改行 → 対応と理由の行 → 空行 → 次の銘柄）
- 前置き・謝辞・自己紹介は一切不要、本文だけ
- 振り返り・今日は各1-2行、合計300文字以内

## 入力データ

### 指標スナップショット
${input.indicatorsBlock}
${input.extrasBlock}

### 直近24hニュース見出し
${input.newsBlock}

### ユーザーの持ち株
${holdingsSection}

## 出力フォーマット (この通りに出力)

📊 振り返り
[1-2行: 日米市場の要点、ニュース文脈を1つ織り込む]

🔮 今日
[1-2行: メイン/リスクシナリオ、断定的に]

💡 持ち株

*[銘柄1または銘柄群1]*
[アクション(利確/HOLD/買い増し) + 一言根拠]

*[銘柄2または銘柄群2]*
[アクション + 一言根拠]

(以下、銘柄群ごとに段落を分けて続ける。空行で区切る。)
`;
}
