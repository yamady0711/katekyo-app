# かてきょ（家庭教師アプリ）

中学受験の苦手分野を、対話形式で教えるPWA。いま使えるモードは次の4つ。

- **国語 記述**：塾の問題を撮影 → 読み取り確認 → 自分の答案 → 質問とヒントで誘導 → 書き直し → 記録
- **算数 場合の数・規則性**：同じ流れ。樹形図・表・書き出しなど中学受験の解き方で、数え上げは子どもにやらせる
- **理科 天体**：同じ流れに加えて、動かせる図（月の満ち欠け・太陽の動きと影・北の空の星）を使う
- **社会 地理**：「なぜそこでさかんか」を考える対話に加え、塾テキストの写真から4択クイズカードを作り、間隔をあけてくり返し出題する（まちがえたカードは翌日、正解するごとに1→3→7→14→30日後）

**すぐできる（写真なし）** — ホームの上にある、写真なしで始められるツール：

- 🔤 **ことばクイズ**：まちがえやすい漢字（使い分け・読み）・慣用句・ことわざの4択。問題は `web/data/kokugo.js`
- 🧮 **特殊算れんしゅう**：つるかめ算・和差算・旅人算・植木算・年齢算・過不足算。数字は毎回ランダムで、答えはプログラムが計算する。ヒント3段階＋解き方。生成は `web/data/tokushu.js`
- 🔭 **天体の図**：月・太陽・星のシミュレーター
- 🗺️ **社会クイズ**：地理・歴史・公民の基本4択（年によって変わる統計は入れない）。問題は `web/data/shakai.js`

クイズでまちがえた問題は次から出やすくなり、「まちがえた問題だけ」も選べる。結果は各科目の「ふりかえり」に残り、まちがえた問題は「なぜ？を先生に聞く」でAIと話せる（`prompts/tool-help.md`）。

どの科目も、科目ページの「ふりかえり」で前回までの記録（要約・会話・問題の写真）を見られる。「この問題をもう一度やる」で同じ写真から解き直せる。新しく始めるときは、同じ科目の直近3回の「つまずき」と「次回の重点」がAIに渡される。

```
prompts/   システムプロンプト（アプリの中核。ここを直して Worker を再デプロイすれば反映される）
  common.md          全モード共通ルール（答えを言わない・短く・模範解答の扱い など）
  kokugo-kijutsu.md  国語記述の診断チェックリストとヒントの段階
  rika-tentai.md     天体のつまずきどころ・シミュレーターの使い方
  sansu-baai.md      算数（場合の数・規則性）の進め方
  chiri.md           地理の「なぜ」の対話
  chiri-quiz.md      テキストの写真からクイズカードを作るときの指示
  tool-help.md       すぐできるツールでまちがえた問題のふりかえり
  summary.md         学習記録（保護者メモ）の作り方
worker/    Cloudflare Worker（Claude API の中継。APIキーはここだけ）
web/       PWA 本体（GitHub Pages で公開）
  app.js   画面の切りかえ・ホーム・科目ページ・チャット
  lib.js   共通部品（保存・API・ダイアログ）
  history.js  ふりかえり・保護者向け記録
  quiz.js  4択クイズの共通部分・地理クイズ（カード作成・間隔反復）
  tools.js すぐできるツール（ことばクイズ・社会クイズ・特殊算れんしゅう）
  data/    ツールの問題集と特殊算の問題生成
  sims/    天体シミュレーター（AIを使わず、計算で正確に描く）
```

## セットアップ（最初の1回）

### 1. Worker をデプロイする（Cloudflare）

Cloudflare のアカウント（無料プランでOK）と、Anthropic の API キーを用意する。

```bash
cd worker
```

```bash
npm install
```

```bash
npx wrangler login
```

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

```bash
npx wrangler secret put APP_PASSCODE
```

`APP_PASSCODE` は、アプリで最初に1回入力する合言葉（好きな文字列）。

```bash
npx wrangler deploy
```

表示された URL（`https://katekyo-worker.<アカウント名>.workers.dev`）を控える。

> Anthropic Console で、月の利用上限（Spend limit）を設定しておくと安心。

### 2. フロントの設定

`web/config.js` の `WORKER_URL` に、手順1の URL を書く。
（書かなくても、アプリの「記録（おうちの人）→ 設定」から端末ごとに入れられる）

### 3. GitHub Pages で公開する

1. GitHub のリポジトリ → Settings → Pages → Source を **GitHub Actions** にする
2. `main` に push すると `.github/workflows/pages.yml` が `web/` を公開する
3. `https://yamady0711.github.io/katekyo-app/` を iPad／スマホの Safari で開き、**共有 → ホーム画面に追加**

> ホーム画面に追加しておかないと、iOS の Safari はしばらく使わないサイトの保存データ（記録）を消すことがある。記録とクイズカードはときどき「書き出す（JSON）」でバックアップする（問題の写真はバックアップに含まれない）。

## 手元で動かす

```bash
cd web && python3 -m http.server 8000
```

```bash
cd worker && echo 'ANTHROPIC_API_KEY=sk-ant-...' > .dev.vars && echo 'APP_PASSCODE=test' >> .dev.vars && npx wrangler dev
```

ブラウザで `http://localhost:8000` を開き、設定で Worker の URL を `http://localhost:8787` にする。

## 調整のしかた

- **返事の中身・口調**：`prompts/*.md` を直して `cd worker && npx wrangler deploy`
- **返事の速さと質**：`worker/wrangler.toml` の `EFFORT`（`low` → 速い／`medium` → じっくり）
- **モデル**：`worker/src/index.ts` の `MODEL`（いまは `claude-opus-5-5`）
- **画面の更新が反映されないとき**：`web/sw.js` の `VERSION` を上げる

## AIへのタグ（プロンプトから使える）

- `[[choices:あってる|ちがう]]`：返事の下に選択ボタンを出す
- `[[sim:moon]]` `[[sim:sun]]` `[[sim:stars]]`：天体シミュレーターを開くボタンを出す
