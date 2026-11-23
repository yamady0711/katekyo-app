// 応援テーマ：息子の好きなものの世界観で、やる気を出す演出をする
// 注意：実在の人物や作品の登場人物の「セリフ」は作らない（本人の言葉に見えるものは書かない）。
//       応援するのは、各テーマの世界にいるオリジナルの応援役。イラストもすべてオリジナル。

const THEME_KEY = "katekyo.theme";

// ---------- オリジナルのイラスト（SVG） ----------
const ART = {
  topgun: `<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="空を飛ぶ戦闘機">
    <defs><linearGradient id="sky1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9a5a"/><stop offset="1" stop-color="#ffd59a"/></linearGradient></defs>
    <rect width="240" height="140" rx="16" fill="url(#sky1)"/>
    <circle cx="190" cy="40" r="18" fill="#fff3c4" opacity=".9"/>
    <path d="M0 118 Q60 100 120 114 T240 108 V140 H0Z" fill="#c9734a" opacity=".55"/>
    <g stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".85"><path d="M18 92 L92 78"/><path d="M24 104 L96 88"/></g>
    <g transform="translate(150 78) rotate(-12)">
      <path d="M-58 0 L40 -6 Q58 -4 62 0 Q58 4 40 6 Z" fill="#5d6b7a"/>
      <path d="M-10 -4 L-30 -34 L-16 -34 L14 -5 Z" fill="#46525f"/>
      <path d="M-10 4 L-30 34 L-16 34 L14 5 Z" fill="#46525f"/>
      <path d="M-56 -2 L-66 -20 L-58 -20 L-44 -3 Z" fill="#46525f"/>
      <path d="M22 -4 Q34 -10 44 -4 Z" fill="#9fd3ff"/>
      <path d="M-58 -2 L-74 0 L-58 2 Z" fill="#ffb347"/>
    </g></svg>`,
  mj: `<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="スポットライトとマイク">
    <rect width="240" height="140" rx="16" fill="#1b1033"/>
    <path d="M70 0 L20 140 H120 Z" fill="#fff6c9" opacity=".18"/><path d="M170 0 L120 140 H220 Z" fill="#c9e6ff" opacity=".16"/>
    <rect x="0" y="118" width="240" height="22" fill="#3a2366"/>
    <g fill="#ffd54a"><path d="M40 30 l3 7 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1z"/><path d="M200 42 l2 5 5 1 -4 3 1 5 -4 -2 -4 2 1 -5 -4 -3 5 -1z"/></g>
    <g fill="#ff7ad1"><circle cx="58" cy="78" r="5"/><rect x="61" y="58" width="3" height="20"/><circle cx="182" cy="86" r="5"/><rect x="185" y="66" width="3" height="20"/><path d="M185 66 h12 v5 h-12z"/></g>
    <rect x="118" y="70" width="4" height="48" fill="#cfd3dc"/><rect x="104" y="116" width="32" height="5" rx="2" fill="#cfd3dc"/>
    <rect x="112" y="40" width="16" height="30" rx="8" fill="#e9ecf2"/><rect x="112" y="40" width="16" height="16" rx="8" fill="#9aa3b5"/>
    </svg>`,
  isagi: `<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ゴールに向かうサッカーボール">
    <rect width="240" height="140" rx="16" fill="#0d2a5c"/>
    <rect x="0" y="96" width="240" height="44" fill="#1f7a3f"/><path d="M0 96 H240" stroke="#fff" stroke-width="2" opacity=".6"/>
    <g stroke="#fff" stroke-width="2" fill="none" opacity=".9"><path d="M150 96 V36 H226 V96"/></g>
    <g stroke="#fff" stroke-width="1" opacity=".35"><path d="M160 36 V96 M172 36 V96 M184 36 V96 M196 36 V96 M208 36 V96 M220 36 V96 M150 48 H226 M150 60 H226 M150 72 H226 M150 84 H226"/></g>
    <g stroke="#7fd0ff" stroke-width="3" stroke-linecap="round" opacity=".8"><path d="M30 70 H86"/><path d="M40 82 H90"/><path d="M48 58 H88"/></g>
    <circle cx="112" cy="70" r="20" fill="#fff"/>
    <path d="M112 60 l9 6 -3 10 h-12 l-3 -10z" fill="#1b1b1b"/><path d="M92 66 l7 -2 3 9 -6 6 -5 -3z M132 66 l-7 -2 -3 9 6 6 5 -3z M104 89 l3 -7 h10 l3 7 -8 2z" fill="#1b1b1b"/>
    </svg>`,
  nakagawa: `<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="警察官の帽子とパトロールの道">
    <rect width="240" height="140" rx="16" fill="#e8f1ff"/>
    <path d="M0 110 H240 V140 H0Z" fill="#9aa9bf"/><path d="M0 124 H240" stroke="#fff" stroke-width="3" stroke-dasharray="18 14"/>
    <rect x="20" y="58" width="34" height="52" fill="#c7d3e6"/><rect x="186" y="46" width="38" height="64" fill="#c7d3e6"/>
    <g fill="#fff" opacity=".8"><rect x="26" y="66" width="8" height="8"/><rect x="40" y="66" width="8" height="8"/><rect x="192" y="54" width="8" height="8"/><rect x="208" y="54" width="8" height="8"/><rect x="192" y="70" width="8" height="8"/></g>
    <path d="M78 76 Q120 40 162 76 Z" fill="#1d2f5e"/>
    <rect x="76" y="74" width="88" height="12" rx="3" fill="#15244a"/>
    <path d="M70 86 Q120 104 170 86 Q120 96 70 86 Z" fill="#0d1733"/>
    <circle cx="120" cy="62" r="9" fill="#f2c94c"/><path d="M120 55 l2 5 5 0 -4 3 2 5 -5 -3 -5 3 2 -5 -4 -3 5 0z" fill="#fff6d0"/>
    <g fill="#f2c94c"><path d="M196 26 l2 4 4 1 -3 3 1 4 -4 -2 -4 2 1 -4 -3 -3 4 -1z"/><path d="M40 30 l2 4 4 1 -3 3 1 4 -4 -2 -4 2 1 -4 -3 -3 4 -1z"/></g>
    </svg>`,
  senna: `<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="走るフォーミュラカー">
    <rect width="240" height="140" rx="16" fill="#cfe7ff"/>
    <path d="M0 98 H240 V140 H0Z" fill="#4a4f5a"/><path d="M0 100 H240" stroke="#e33" stroke-width="4" stroke-dasharray="12 12"/><path d="M0 100 H240" stroke="#fff" stroke-width="4" stroke-dasharray="12 12" stroke-dashoffset="12"/>
    <g transform="translate(176 22)"><rect width="40" height="28" fill="#fff"/><g fill="#1b1b1b"><rect width="10" height="7"/><rect x="20" width="10" height="7"/><rect x="10" y="7" width="10" height="7"/><rect x="30" y="7" width="10" height="7"/><rect y="14" width="10" height="7"/><rect x="20" y="14" width="10" height="7"/><rect x="10" y="21" width="10" height="7"/><rect x="30" y="21" width="10" height="7"/></g><rect x="-3" y="0" width="3" height="60" fill="#666"/></g>
    <g stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"><path d="M8 72 H40"/><path d="M14 84 H44"/></g>
    <g transform="translate(48 56)">
      <path d="M10 30 L40 24 L90 22 L128 26 L150 32 L150 38 L10 38 Z" fill="#e8eaee"/>
      <path d="M40 24 L90 22 L100 30 L36 32 Z" fill="#e2392f"/>
      <rect x="140" y="16" width="14" height="6" fill="#e2392f"/><rect x="146" y="20" width="3" height="12" fill="#333"/>
      <rect x="0" y="20" width="12" height="5" fill="#e2392f"/>
      <circle cx="78" cy="22" r="9" fill="#ffd400"/><path d="M70 22 h16" stroke="#1aa34a" stroke-width="3"/><path d="M72 18 h12" stroke="#1f5fbf" stroke-width="2"/>
      <circle cx="30" cy="38" r="12" fill="#1b1b1b"/><circle cx="30" cy="38" r="4" fill="#888"/>
      <circle cx="128" cy="38" r="12" fill="#1b1b1b"/><circle cx="128" cy="38" r="4" fill="#888"/>
    </g></svg>`,
  chiron: `<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="猛スピードのハイパーカー">
    <defs><linearGradient id="road6" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0b1020"/><stop offset="1" stop-color="#1c2647"/></linearGradient></defs>
    <rect width="240" height="140" rx="16" fill="url(#road6)"/>
    <g stroke="#6fb6ff" stroke-width="2" stroke-linecap="round" opacity=".7"><path d="M6 60 H70"/><path d="M14 76 H60"/><path d="M4 92 H52"/><path d="M20 44 H64"/></g>
    <path d="M0 112 H240" stroke="#3b4a7a" stroke-width="2"/>
    <g transform="translate(46 58)">
      <path d="M4 40 Q8 26 30 22 L70 10 Q100 4 130 12 L170 26 Q186 30 188 40 L188 46 L4 46 Z" fill="#1d4ed8"/>
      <path d="M70 10 Q100 4 130 12 L150 22 L60 24 Z" fill="#0b1b4d"/>
      <path d="M96 9 Q86 26 98 44" stroke="#c9d6ff" stroke-width="3" fill="none"/>
      <path d="M98 44 Q112 30 104 10" fill="#0f2a7a" opacity=".9"/>
      <path d="M176 32 h10 v5 h-10z" fill="#fff" opacity=".9"/><path d="M6 34 h10 v4 h-10z" fill="#ff4d4d"/>
      <circle cx="40" cy="46" r="13" fill="#111"/><circle cx="40" cy="46" r="5" fill="#9aa3b5"/>
      <circle cx="150" cy="46" r="13" fill="#111"/><circle cx="150" cy="46" r="5" fill="#9aa3b5"/>
    </g></svg>`,
};

// ---------- 応援の言葉（テーマの世界のオリジナル応援役から） ----------
export const THEMES = {
  topgun: {
    label: "トップガン", emoji: "✈️", sub: "戦闘機パイロットの世界", coach: "教官",
    hello: ["パイロット、準備はいいか？ 今日のミッションを始めよう！", "エンジン始動！ 今日も限界のその先へ飛ぼう。", "滑走路はクリアだ。離陸の準備をしよう！"],
    start: ["ミッション開始！ ターゲットは目の前の1問だ。", "離陸！ 落ち着いて、計器（問題文）をよく読もう。"],
    correct: ["ロックオン成功！ 🎯", "ターゲット撃破！ ナイスフライト！", "完璧な着艦だ！"],
    wrong: ["まだ燃料はある。もう一度アプローチだ！", "失速しても立て直せばいい。次いこう！", "訓練はミスから学ぶものだ。"],
    finish: ["ミッション完了！ 見事なフライトだった。", "全機帰還！ 今日の訓練は合格だ。"],
  },
  mj: {
    label: "マイケル・ジャクソン", emoji: "🎤", sub: "キング・オブ・ポップのステージ", coach: "ステージ監督",
    hello: ["今日のステージの幕が上がるよ！ スポットライトはきみに。", "リハーサルの時間だ。ひとつひとつ、ステップをきめよう！", "観客が待ってる！ 今日もいいショーにしよう。"],
    start: ["ショータイム！ 最初のステップから、ていねいにいこう。", "音楽スタート！ リズムにのって考えよう。"],
    correct: ["完璧なステップ！ 🌟", "観客総立ちだ！", "キレのあるダンスだ！"],
    wrong: ["リハーサルはミスするためにある。もう一回！", "リズムをとりなおして、次のステップへ！", "名ステージも練習のくり返しから。"],
    finish: ["アンコールの大歓声！ 最高のステージだった！", "幕が下りた。今日のショーは大成功！"],
  },
  isagi: {
    label: "ブルーロック", emoji: "⚽", sub: "ストライカーの世界", coach: "コーチ",
    hello: ["ストライカー、今日のゴールを決めにいこう！", "ピッチに立て！ ゴールまでのルートを見つけるのはきみだ。", "フィールド全体を見わたして、勝ち筋を探そう！"],
    start: ["キックオフ！ まずは問題の全体を見わたそう。", "ゴールへのルートを、自分の頭で組み立てよう！"],
    correct: ["ゴール！！ ⚽", "ナイスシュート！ 完璧な決定力だ！", "読みどおり！ 最高のゴールだ！"],
    wrong: ["シュートは外してもいい。次のチャンスで決めろ！", "相手の動きを読み直そう。もう一回！", "ミスを分析できるやつが強くなる。"],
    finish: ["試合終了！ きみが今日のMVPだ！", "ハットトリック達成！ よく戦った！"],
  },
  nakagawa: {
    label: "こち亀（中川）", emoji: "🚓", sub: "スマートなエリート警官の世界", coach: "署の先輩",
    hello: ["本日のパトロール、スマートに始めよう。", "落ち着いて、冷静に。事件（問題）を解決しにいこう！", "準備は万全。今日もエレガントにいこう。"],
    start: ["パトロール開始。まずは現場（問題文）を観察しよう。", "冷静に手がかりを集めよう。"],
    correct: ["事件解決！ 見事な推理だ。🚨", "スマートな解決だね！", "エリートの仕事だ！"],
    wrong: ["手がかりをもう一度確かめよう。あわてずに。", "名捜査官も、ときにはまちがえる。次だ。", "冷静に。見落としがないか見てみよう。"],
    finish: ["本日の任務、完了！ おつかれさま。", "すべて解決。今日もスマートだった！"],
  },
  senna: {
    label: "アイルトン・セナ", emoji: "🏎️", sub: "F1レースの世界", coach: "レースエンジニア",
    hello: ["こちらピット。マシンの準備はOK、いつでも出られるよ！", "グリッドにつこう。今日もファステストラップをねらおう！", "タイヤは温まった。1周ずつ集中していこう。"],
    start: ["シグナル消灯、スタート！ 1周目は落ち着いていこう。", "コースをよく見て、ブレーキングポイントを見きわめよう。"],
    correct: ["ファステストラップ更新！ 🏁", "完璧なコーナリング！", "オーバーテイク成功！"],
    wrong: ["コースアウトしても大丈夫、まだレースは続く！", "ピットイン。立て直して、次の周で取り返そう。", "雨のレースでもあきらめないのがドライバーだ。"],
    finish: ["チェッカーフラッグ！ 優勝おめでとう！ 🏆", "ポールトゥウィン！ 今日のレースは完璧だ。"],
  },
  chiron: {
    label: "ブガッティ シロン", emoji: "🚗", sub: "世界最速ハイパーカーの世界", coach: "テストドライバー",
    hello: ["エンジン始動！ 今日も最高速をめざそう。", "テストコースは貸し切りだ。全開でいこう！", "時速400kmの世界も、1メートルずつの積み重ねだ。"],
    start: ["アクセルオン！ まずは安全にウォームアップ。", "ギアを1速に。ていねいに加速していこう。"],
    correct: ["トップスピード到達！ 🚀", "記録更新！", "フル加速、完璧だ！"],
    wrong: ["スピードを落としてコースを確認しよう。", "最高速も、何度もテストしてたどり着くもの。もう一回！", "ブレーキも大事な技術だ。落ち着いていこう。"],
    finish: ["テスト走行完了！ 新記録だ！", "最高速アタック成功！ おつかれさま！"],
  },
};

export const THEME_KEYS = Object.keys(THEMES);

// 選ばれたテーマ（「日がわり」のときは日付で決める）
export function themeSetting() { try { return JSON.parse(localStorage.getItem(THEME_KEY)) || "daily"; } catch { return "daily"; } }
export function setThemeSetting(v) { try { localStorage.setItem(THEME_KEY, JSON.stringify(v)); } catch {} }
export function currentThemeKey() {
  const v = themeSetting();
  if (THEMES[v]) return v;
  const d = new Date();
  const n = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000);
  return THEME_KEYS[n % THEME_KEYS.length];
}
export const currentTheme = () => THEMES[currentThemeKey()];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const cheer = (kind, key = currentThemeKey()) => pick(THEMES[key][kind]);

// イラスト要素（img にして SVG を安全に表示）
export function themeArt(key = currentThemeKey(), cls = "theme-art") {
  const img = document.createElement("img");
  img.className = cls;
  img.alt = THEMES[key].sub;
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ART[key])}`;
  return img;
}
