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
