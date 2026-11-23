// すぐできるツール（写真なし）：ことばクイズ・社会クイズ・特殊算れんしゅう
import { LS, lsGet, lsSet, h, $app, go, topbar, confirmDialog } from "./lib.js";
import { runQuiz, showQuizResult } from "./quiz.js";
import { KOKUGO, KOKUGO_CATS } from "./data/kokugo.js";
import { SHAKAI, SHAKAI_CATS } from "./data/shakai.js";
import { makeProblem, TOKUSHU_TYPES } from "./data/tokushu.js";

const QUIZ_SIZE = 10;
const DRILL_SIZE = 5;

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

// 問題ごとの成績（正解・まちがいの回数）。まちがえた問題ほど出やすくする
const getStats = () => lsGet(LS.bank, {});
function record(id, correct) {
  const s = getStats();
  const x = s[id] ?? { r: 0, w: 0 };
  if (correct) x.r++; else x.w++;
  s[id] = x;
  lsSet(LS.bank, s);
}
const isWeak = (stats, id) => (stats[id]?.w ?? 0) > (stats[id]?.r ?? 0);

function pickQuestions(items, onlyWeak) {
  const stats = getStats();
  if (onlyWeak) return shuffle(items.filter((q) => isWeak(stats, q.id))).slice(0, QUIZ_SIZE);
  const weak = shuffle(items.filter((q) => isWeak(stats, q.id)));
  const unseen = shuffle(items.filter((q) => !stats[q.id]));
  const rest = shuffle(items.filter((q) => stats[q.id] && !isWeak(stats, q.id)));
  // 苦手を最大4問、のこりは未出題を優先
  return [...weak.slice(0, 4), ...unseen, ...rest, ...weak.slice(4)].slice(0, QUIZ_SIZE);
}

// ============ 4択クイズの選択画面（国語・社会で共通） ============

function quizMenu({ title, emoji, bank, cats, mode, label, hash, note }) {
  const stats = getStats();
  const start = (cat, onlyWeak = false) => {
    const items = cat === "all" ? bank : bank.filter((q) => q.cat === cat);
    const picked = pickQuestions(items, onlyWeak);
    if (!picked.length) return alert("まちがえた問題はありません！");
    const catLabel = cat === "all" ? "ぜんぶ" : cats.find((c) => c[0] === cat)[1];
    runQuiz({
      title: `${emoji} ${title}`, back: hash, mode, askMode: "tool",
      unitLabel: `${label}（${onlyWeak ? "まちがえた問題" : catLabel}）`,
      cards: picked.map((q) => ({ id: q.id, question: q.q, answer: q.a, wrongChoices: q.w, why: q.why, unit: cats.find((c) => c[0] === q.cat)[1] })),
      onAnswer: (card, correct) => record(card.id, correct),
    });
  };
  const weakCount = bank.filter((q) => isWeak(stats, q.id)).length;
  const seen = bank.filter((q) => stats[q.id]).length;
  $app.replaceChildren(
    topbar(`${emoji} ${title}`, () => (history.length > 1 ? history.back() : go("#"))),
    h("div", { class: "page" },
      h("p", { class: "muted" }, `1回${QUIZ_SIZE}問。まちがえた問題は、あとでまた出やすくなるよ。（${bank.length}問中 ${seen}問にちょうせん済み）`),
      h("div", { class: "actions" },
        cats.map(([key, name]) => h("button", { class: "big-action plain-action", onclick: () => start(key) },
          h("span", { class: "emoji" }, "▶"), h("span", {}, h("b", {}, name), h("span", { class: "muted" }, `${bank.filter((q) => q.cat === key).length}問`)))),
        h("button", { class: "big-action plain-action", onclick: () => start("all") }, h("span", { class: "emoji" }, "🔀"), h("span", {}, h("b", {}, "ぜんぶまぜる"))),
        weakCount ? h("button", { class: "big-action weak-action", onclick: () => start("all", true) }, h("span", { class: "emoji" }, "🔁"),
          h("span", {}, h("b", {}, `まちがえた問題だけ（${weakCount}問）`))) : null),
      note ? h("p", { class: "muted", style: "margin-top:16px" }, note) : null),
  );
}

export function viewKotoba() {
  quizMenu({ title: "ことばクイズ", emoji: "🔤", bank: KOKUGO, cats: KOKUGO_CATS, mode: "kokugo-kijutsu", label: "ことばクイズ", hash: "#tool/kotoba" });
}

export function viewShakaiQuiz() {
  quizMenu({ title: "社会クイズ", emoji: "🗺️", bank: SHAKAI, cats: SHAKAI_CATS, mode: "chiri", label: "社会クイズ", hash: "#tool/shakai",
    note: "生産量の順位など、年によって変わる統計は入れていません。統計は塾テキストの数字で覚えよう。" });
}

// ============ 特殊算れんしゅう ============

export function viewTokushu() {
  $app.replaceChildren(
    topbar("🧮 特殊算れんしゅう", () => (history.length > 1 ? history.back() : go("#"))),
    h("div", { class: "page" },
      h("p", { class: "muted" }, `1回${DRILL_SIZE}問。数字は毎回かわるよ。こまったら「ヒント」をおしてね。`),
      h("div", { class: "actions" },
        [...TOKUSHU_TYPES, ["mix", "いろいろまぜる"]].map(([key, name]) =>
          h("button", { class: "big-action plain-action", onclick: () => drill(key, name) },
            h("span", { class: "emoji" }, key === "mix" ? "🔀" : "▶"), h("span", {}, h("b", {}, name)))))),
  );
}

function drill(type, typeName) {
  const problems = Array.from({ length: DRILL_SIZE }, () => makeProblem(type));
  const results = [];
  let index = 0;
  const startedAt = new Date().toISOString();
  const body = h("div", { class: "page quiz" });
  $app.replaceChildren(topbar(`🧮 ${typeName}`, async () => {
    if (!results.length) return go("#tool/tokushu");
    if (await confirmDialog("れんしゅうをやめる？", "やめる", "ここまでの結果は記録されません")) go("#tool/tokushu");
  }), body);

  function show() {
    const p = problems[index];
    let hintsShown = 0, done = false;
    const hintBox = h("div", { class: "hints" });
    const feedback = h("div");
    const input = h("input", { type: "text", inputmode: "numeric", pattern: "[0-9]*", class: "num-input", placeholder: "答え", autocomplete: "off",
      onkeydown: (e) => { if (e.key === "Enter") check(); } });
    const checkBtn = h("button", { class: "btn", onclick: check }, "答える");
    const hintBtn = h("button", { class: "btn small ghost", onclick: showHint }, "💡 ヒント");
    const giveUpBtn = h("button", { class: "btn small plain", onclick: () => finishProblem(null) }, "答えと解き方を見る");

    function showHint() {
      if (hintsShown >= p.hints.length) return;
      hintBox.append(h("div", { class: "hint-item" }, `ヒント${hintsShown + 1}：${p.hints[hintsShown]}`));
      hintsShown++;
      if (hintsShown >= p.hints.length) hintBtn.disabled = true;
    }

    function check() {
      if (done) return;
      const v = Number(String(input.value).replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[^0-9.]/g, ""));
      if (!input.value.trim() || Number.isNaN(v)) { input.focus(); return; }
      if (v === p.answer) finishProblem(v);
      else {
        feedback.replaceChildren(h("div", { class: "feedback ng" }, h("div", {}, `${v}${p.unit}…ちがうみたい。もう一度考えてみよう。ヒントも使ってね。`)));
        if (!p.firstWrong) p.firstWrong = v;
      }
    }

    function finishProblem(v) {
      done = true;
      const correct = v === p.answer && !p.firstWrong;
      results.push({ p, correct, chosen: p.firstWrong ?? v, hints: hintsShown });
      [input, checkBtn, hintBtn, giveUpBtn].forEach((x) => (x.disabled = true));
      feedback.replaceChildren(
        h("div", { class: `feedback ${v === p.answer ? "ok" : "ng"}` },
          h("div", { class: "big" }, v === p.answer ? (correct ? "⭕ せいかい！" : "⭕ せいかい！（2回目で）") : `答えは ${p.answer}${p.unit}`),
          h("b", {}, "解き方"),
          h("ol", { class: "solution" }, p.solution.map((s) => h("li", {}, s)))),
        h("button", { class: "btn wide", onclick: next }, index + 1 < problems.length ? "つぎの問題" : "結果を見る"));
      feedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    body.replaceChildren(
      h("div", { class: "quiz-progress" },
        h("div", { class: "bar" }, h("span", { style: `width:${(index / problems.length) * 100}%` })),
        h("span", { class: "muted" }, `${index + 1} / ${problems.length}`)),
      h("div", { class: "muted" }, p.title),
      h("div", { class: "question" }, p.q),
      h("div", { class: "answer-row" }, input, h("span", { class: "unit" }, p.unit), checkBtn),
      h("div", { class: "row" }, hintBtn, giveUpBtn),
      hintBox,
      feedback);
    window.scrollTo(0, 0);
  }

  function next() {
    index++;
    if (index < problems.length) show();
    else {
      const wrong = results.filter((r) => !r.correct).map((r) => ({
        question: r.p.q, answer: `${r.p.answer}${r.p.unit}`, chosen: r.chosen != null ? `${r.chosen}${r.p.unit}` : "（解き方を見た）",
        why: r.p.solution.join(" ／ "), unit: r.p.title,
      }));
      showQuizResult({
        mode: "sansu-baai", unitLabel: `特殊算（${typeName}）`, askMode: "tool", back: "#tool/tokushu", startedAt,
        score: results.length - wrong.length, total: results.length, wrong, body,
      });
    }
  }

  show();
}
