// 地理クイズ：塾テキストの写真からカードを作り、間隔をあけてくり返し出題する
import {
  LS, lsGet, lsSet, h, $app, $overlay, closeOverlay, confirmDialog, go, topbar, busyDialog, toast,
  api, addRecord, newId, photoSection,
} from "./lib.js";
import { askWhy } from "./history.js";

// 正解するたびに次に出すまでの日数をのばす（箱 0〜5）
const INTERVALS = [0, 1, 3, 7, 14, 30];
const SESSION_SIZE = 10;

const getDeck = () => lsGet(LS.deck, []);
const saveDeck = (deck) => lsSet(LS.deck, deck);

function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const dueCount = () => getDeck().filter((c) => c.due <= todayStr()).length;

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

// ============ クイズ ============

export function viewQuiz(practice = false) {
  const deck = getDeck();
  if (!deck.length) {
    $app.replaceChildren(topbar("🃏 地理クイズ", "#subject/chiri"), h("div", { class: "page" },
      h("p", {}, "まだクイズカードがありません。"),
      h("button", { class: "btn wide", onclick: () => go("#quizmake") }, "➕ テキストからクイズを作る")));
    return;
  }
  const today = todayStr();
  let queue = practice
    ? shuffle(deck).slice(0, SESSION_SIZE)
    : deck.filter((c) => c.due <= today).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.box - b.box)).slice(0, SESSION_SIZE);
  if (!queue.length) {
    $app.replaceChildren(topbar("🃏 地理クイズ", "#subject/chiri"), h("div", { class: "page center" },
      h("div", { class: "big-emoji" }, "🎉"),
      h("p", {}, "今日のクイズは、ぜんぶおわり！"),
      h("p", { class: "muted" }, "まちがえた問題や、時間がたった問題は、また出てくるよ。"),
      h("button", { class: "btn wide", onclick: () => viewQuiz(true) }, `ぜんぶのカードから${Math.min(SESSION_SIZE, deck.length)}問練習する`)));
    return;
  }

  const total = queue.length;
  const results = new Map(); // id → { correct, chosen }（1回目の答え）
  const retried = new Set();
  let index = 0;
  const startedAt = new Date().toISOString();
  const body = h("div", { class: "page quiz" });
  $app.replaceChildren(topbar(practice ? "🃏 練習クイズ" : "🃏 今日のクイズ", async () => {
    if (await confirmDialog("クイズをやめる？", "やめる", "ここまでの結果は記録されません")) go("#subject/chiri");
  }), body);

  function show() {
    const card = queue[index];
    const isRetry = results.has(card.id);
    const choices = shuffle([card.answer, ...card.wrongChoices.slice(0, 3)]);
    const progress = h("div", { class: "quiz-progress" },
      h("div", { class: "bar" }, h("span", { style: `width:${(Math.min(results.size, total) / total) * 100}%` })),
      h("span", { class: "muted" }, isRetry ? "もう一回！" : `${results.size + 1} / ${total}`));
    const feedback = h("div");
    const buttons = choices.map((c) => h("button", { class: "choice", onclick: () => answer(c) }, c));

    function answer(chosen) {
      const correct = chosen === card.answer;
      buttons.forEach((b) => {
        b.disabled = true;
        if (b.textContent === card.answer) b.classList.add("right");
        else if (b.textContent === chosen) b.classList.add("wrong");
      });
      if (!isRetry) {
        results.set(card.id, { correct, chosen });
        updateCard(card.id, correct);
      }
      if (!correct && !retried.has(card.id)) { retried.add(card.id); queue.push(card); }
      feedback.replaceChildren(h("div", { class: `feedback ${correct ? "ok" : "ng"}` },
        h("div", { class: "big" }, correct ? "⭕ せいかい！" : `❌ 答えは「${card.answer}」`),
        card.why ? h("div", {}, "💡 ", card.why) : null),
        h("button", { class: "btn wide", onclick: next }, index + 1 < queue.length ? "つぎへ" : "結果を見る"));
    }

    body.replaceChildren(progress,
      h("div", { class: "muted" }, card.unit || ""),
      h("div", { class: "question" }, card.question),
      h("div", { class: "choices" }, buttons),
      feedback);
  }

  function next() {
    index++;
    if (index < queue.length) show();
    else finish();
  }

  function finish() {
    const first = queue.slice(0, total);
    const wrong = first.filter((c) => !results.get(c.id)?.correct).map((c) => ({
      question: c.question, answer: c.answer, chosen: results.get(c.id)?.chosen, why: c.why, unit: c.unit,
    }));
    const score = total - wrong.length;
    const rate = score / total;
    addRecord({
      id: newId(), kind: "quiz", mode: "chiri", startedAt, endedAt: new Date().toISOString(),
      unit: practice ? "地理クイズ（練習）" : "地理クイズ", score, total, wrong,
      stumbles: wrong.map((w) => `${w.question} → ${w.answer}（答え：${w.chosen ?? "—"}）`),
      finalState: rate === 1 ? "自力で完成" : "未完成",
      parentAttention: rate >= 0.8 ? "low" : rate >= 0.5 ? "medium" : "high",
      parentNote: `正答率 ${Math.round(rate * 100)}%`,
    });
    body.replaceChildren(
      h("div", { class: "center" },
        h("div", { class: "big-emoji" }, rate === 1 ? "🌟" : rate >= 0.7 ? "😊" : "💪"),
        h("div", { class: "score" }, `${total}問中 ${score}問 せいかい`)),
      wrong.length ? h("h2", {}, "まちがえた問題") : h("p", { class: "center" }, "全問正解！すごい！"),
      ...wrong.map((w) => h("div", { class: "record" },
        h("div", { class: "unit" }, w.question),
        h("div", {}, "答え：", h("b", {}, w.answer)),
        w.why ? h("div", { class: "note" }, "💡 ", w.why) : null,
        h("div", { class: "row" }, h("button", { class: "btn small", onclick: () => askWhy(w) }, "🤔 なぜ？を先生に聞く")))),
      h("button", { class: "btn wide", style: "margin-top:16px", onclick: () => go("#subject/chiri") }, "おわる"));
  }

  function updateCard(id, correct) {
    if (practice && correct) return; // 練習では、正解しても間隔はのばさない
    const deck = getDeck();
    const c = deck.find((x) => x.id === id);
    if (!c) return;
    if (correct) { c.box = Math.min((c.box ?? 0) + 1, INTERVALS.length - 1); c.right = (c.right ?? 0) + 1; }
    else { c.box = 0; c.wrong = (c.wrong ?? 0) + 1; }
    c.due = todayStr(correct ? INTERVALS[c.box] : 1);
    saveDeck(deck);
  }

  show();
}

// ============ クイズを作る ============

export function viewQuizMake() {
  const photos = [];
  let busy = 0;
  const makeBtn = h("button", { class: "btn wide", disabled: true, onclick: make }, "クイズを作る");
  const onChange = (d) => {
    busy += d;
    makeBtn.disabled = busy > 0 || photos.length === 0;
    makeBtn.textContent = busy > 0 ? "写真を準備中…" : "クイズを作る";
  };
  const result = h("div");
  const deckArea = h("div");

  async function make() {
    busyDialog("クイズを作っています…", "30秒〜1分くらいかかるよ");
    try {
      const content = photos.map((p) => ({ type: "image", source: { type: "base64", ...p } }));
      content.push({ type: "text", text: "この塾テキストのページから、クイズカードを作ってください。" });
      const res = await api("/api/quiz", { mode: "chiri", messages: [{ role: "user", content }] });
      const data = await res.json();
      closeOverlay();
      review(data);
    } catch (e) {
      closeOverlay();
      alert(e.message);
    }
  }

  function review({ cards, note }) {
    if (!cards?.length) { result.replaceChildren(h("p", {}, "カードを作れませんでした。写真を撮り直してみてね。"), note ? h("p", { class: "muted" }, note) : null); return; }
    const keep = cards.map(() => true);
    const saveBtn = h("button", { class: "btn wide" });
    const refresh = () => { const n = keep.filter(Boolean).length; saveBtn.textContent = `えらんだ${n}枚を保存する`; saveBtn.disabled = n === 0; };
    saveBtn.onclick = () => {
      const deck = getDeck();
      const today = todayStr();
      cards.forEach((c, i) => {
        if (!keep[i]) return;
        deck.push({ id: newId(), unit: c.unit, question: c.question, answer: c.answer, wrongChoices: c.wrongChoices.slice(0, 3), why: c.why, box: 0, due: today, created: today, right: 0, wrong: 0 });
      });
      saveDeck(deck);
      toast(`${keep.filter(Boolean).length}枚のカードを保存したよ`);
      go("#subject/chiri");
    };
    result.replaceChildren(
      h("h2", {}, `できたカード（${cards.length}枚）`),
      h("p", { class: "muted" }, "おうちの人へ：答えや数字がテキストと合っているか確認して、まちがったカードはチェックを外してください。"),
      note ? h("div", { class: "concern" }, "⚠️ ", note) : null,
      ...cards.map((c, i) => h("label", { class: "card-review" },
        h("input", { type: "checkbox", checked: true, onchange: (e) => { keep[i] = e.target.checked; refresh(); } }),
        h("div", {},
          h("div", { class: "muted" }, c.unit),
          h("b", {}, c.question),
          h("div", {}, "答え：", h("span", { class: "answer" }, c.answer), h("span", { class: "muted" }, `　ほか：${c.wrongChoices.join("／")}`)),
          c.why ? h("div", { class: "muted" }, "💡 ", c.why) : null))),
      saveBtn);
    refresh();
    result.scrollIntoView({ behavior: "smooth" });
  }

  function drawDeck() {
    const deck = getDeck();
    deckArea.replaceChildren(h("details", { class: "deck" },
      h("summary", {}, `今あるカード（${deck.length}枚）`),
      ...deck.map((c) => h("div", { class: "deck-row" },
        h("div", {}, h("b", {}, c.question), h("div", { class: "muted" }, `答え：${c.answer}　${"★".repeat(c.box ?? 0)}${"☆".repeat(5 - (c.box ?? 0))}　つぎ：${c.due}`)),
        h("button", { class: "btn small plain", onclick: async () => {
          if (!(await confirmDialog("このカードを消す？", "消す", c.question))) return;
          saveDeck(getDeck().filter((x) => x.id !== c.id)); drawDeck();
        } }, "消す")))));
  }

  $app.replaceChildren(
    topbar("➕ クイズを作る", "#subject/chiri"),
    h("div", { class: "page" },
      photoSection(photos, "塾テキストのページ", "工業・農業などのページを撮ってね（何まいでもOK）。写っている内容だけからクイズを作るよ", onChange),
      h("div", { class: "start-area" }, makeBtn),
      result,
      deckArea),
  );
  drawDeck();
}
