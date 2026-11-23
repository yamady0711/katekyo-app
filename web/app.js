import { SIMS } from "./sims/index.js";
import {
  MODES, idb, h, parseReply, renderText, fmtDate, shrinkImage, imgSrc, api, streamChat,
  $app, $overlay, closeOverlay, confirmDialog, openSim, setRouter, go, topbar, busyDialog,
  getRecords, upsertRecord, startSession, photoSection, saveSessionProgress, summarizeSession, closeCurrentSession,
} from "./lib.js";
import { viewHistory, viewRecords, historyRow } from "./history.js";
import { viewQuiz, viewQuizMake, dueCount } from "./quiz.js";
import { viewKotoba, viewShakaiQuiz, viewTokushu } from "./tools.js";
import { overBudget } from "./usage.js";

// 写真なしですぐできるツール
const TOOLS = [
  { hash: "#tool/kotoba", emoji: "🔤", name: "ことばクイズ", desc: "漢字・慣用句・ことわざ", cls: "kokugo", mode: "kokugo-kijutsu" },
  { hash: "#tool/tokushu", emoji: "🧮", name: "特殊算れんしゅう", desc: "つるかめ算・旅人算など", cls: "sansu", mode: "sansu-baai" },
  { hash: "#sims", emoji: "🔭", name: "天体の図", desc: "月・太陽・星を動かす", cls: "tentai", mode: "rika-tentai" },
  { hash: "#tool/shakai", emoji: "🗺️", name: "社会クイズ", desc: "地理・歴史・公民", cls: "chiri", mode: "chiri" },
];
const toolTile = (t) => h("button", { class: `tool-tile ${t.cls}`, onclick: () => go(t.hash) },
  h("span", { class: "emoji" }, t.emoji), h("b", {}, t.name), h("span", { class: "desc" }, t.desc));

// ============ 画面：ホーム ============

function resumeBanner(current, onDiscard) {
  if (!current) return null;
  return h("div", { class: "resume" },
    h("span", {}, `とちゅうの学習があります（${MODES[current.mode]?.label ?? ""}・${fmtDate(current.startedAt)}）`),
    h("button", { class: "btn small", onclick: () => go("#chat") }, "つづける"),
    h("button", { class: "btn small plain", onclick: async () => {
      if (await confirmDialog("とちゅうの学習をおわりにする？", "おわりにする", "そこまでの記録は「ふりかえり」に残るよ")) { await closeCurrentSession(); onDiscard(); }
    } }, "おわりにする"));
}

async function viewHome() {
  const current = await idb.get("current");
  const due = dueCount();
  $app.replaceChildren(h("div", { class: "page" },
    h("div", { class: "hero" },
      h("div", { class: "logo" }, "かてきょ"),
      h("div", { class: "muted" }, "苦手なところを、いっしょに考えよう")),
    resumeBanner(current, viewHome),
    h("h2", { class: "section-title" }, "すぐできる（写真なし）"),
    h("div", { class: "tool-grid" }, TOOLS.map(toolTile)),
    h("h2", { class: "section-title" }, "写真で問題を聞く・ふりかえり"),
    h("div", { class: "modes" },
      Object.entries(MODES).map(([key, m]) => h("button", { class: `mode-card ${m.cls}`, onclick: () => go(`#subject/${key}`) },
        h("span", { class: "emoji" }, m.emoji), h("span", { class: "name" }, m.label), h("span", { class: "desc" }, m.desc),
        key === "chiri" && due ? h("span", { class: "due-pill" }, `今日のクイズ ${due}問`) : null))),
    h("div", { class: "links" },
      h("button", { class: "link-row", onclick: () => go("#records") },
        h("span", { class: "emoji" }, "📒"), h("span", {}, h("b", {}, "記録（おうちの人）"), h("span", { class: "muted" }, overBudget() ? "⚠️ AIの使用量が今月の目安をこえました" : "つまずきの記録・AIの使用量・設定")))),
  ));
}

// ============ 画面：科目のページ（始める＋ふりかえり） ============

async function viewSubject(mode) {
  const m = MODES[mode];
  if (!m) return go("#");
  const current = await idb.get("current");
  const records = getRecords().filter((r) => r.mode === mode);

  async function startNew() {
    if (current && !(await confirmDialog("とちゅうの学習があるよ。新しく始める？", "新しく始める", "とちゅうの学習は、そこまで「ふりかえり」に記録されるよ"))) return;
    await closeCurrentSession();
    go(`#setup/${mode}`);
  }

  const actions = [
    h("button", { class: `big-action ${m.cls}`, onclick: startNew }, h("span", { class: "emoji" }, "📷"),
      h("span", {}, h("b", {}, "問題を聞く"), h("span", { class: "muted" }, "塾の問題を撮って、いっしょに考える"))),
  ];
  if (mode === "chiri") {
    const due = dueCount();
    actions.push(
      h("button", { class: "big-action chiri", onclick: () => go("#quiz") }, h("span", { class: "emoji" }, "🃏"),
        h("span", {}, h("b", {}, due ? `今日のクイズ（${due}問）` : "クイズ"), h("span", { class: "muted" }, "まちがえた問題は、間をあけてまた出るよ"))),
      h("button", { class: "link-row", onclick: () => go("#quizmake") }, h("span", { class: "emoji" }, "➕"),
        h("span", {}, h("b", {}, "テキストからクイズを作る"), h("span", { class: "muted" }, "塾テキストのページを撮ると、クイズカードができる"))));
  }
  for (const t of TOOLS.filter((t) => t.mode === mode)) {
    actions.push(h("button", { class: "link-row", onclick: () => go(t.hash) }, h("span", { class: "emoji" }, t.emoji),
      h("span", {}, h("b", {}, `${t.name}（写真なし）`), h("span", { class: "muted" }, t.desc))));
  }

  $app.replaceChildren(
    topbar(`${m.emoji} ${m.label}`, "#"),
    h("div", { class: "page" },
      current?.mode === mode ? resumeBanner(current, () => viewSubject(mode)) : null,
      h("div", { class: "actions" }, actions),
      h("h2", {}, "ふりかえり"),
      records.length
        ? h("div", { class: "history-list" }, records.map((r) => historyRow(r, current?.id)))
        : h("p", { class: "muted" }, "まだ記録はありません。学習を「おわる」と、ここに残るよ。")),
  );
}

function viewSims() {
  $app.replaceChildren(
    topbar("天体の図で調べる", () => history.length > 1 ? history.back() : go("#")),
    h("div", { class: "page sim-list" },
      Object.entries(SIMS).map(([key, s]) => h("button", { class: "link-row", onclick: () => openSim(key) },
        h("span", { class: "emoji" }, s.emoji), h("span", {}, h("b", {}, s.title), h("span", { class: "muted" }, s.desc))))),
  );
}

// ============ 画面：写真の準備 ============

function viewSetup(mode) {
  const m = MODES[mode];
  if (!m) return go("#");
  const photos = { problem: [], answer: [] };
  let busy = 0;
  const startBtn = h("button", { class: "btn wide", disabled: true, onclick: start }, "はじめる");
  const onChange = (d) => {
    busy += d;
    startBtn.disabled = busy > 0 || photos.problem.length === 0;
    startBtn.textContent = busy > 0 ? "写真を準備中…" : "はじめる";
  };

  async function start() {
    startBtn.disabled = true;
    await startSession(mode, photos);
    go("#chat");
  }

  $app.replaceChildren(
    topbar(`${m.emoji} ${m.label}`, `#subject/${mode}`),
    h("div", { class: "page" },
      photoSection(photos.problem, "① 問題の写真", m.problemHint, onChange),
      photoSection(photos.answer, "② 答えの写真（あれば）", "塾の模範解答。きみには見せずに、先生が答え合わせに使うよ", onChange),
      h("div", { class: "start-area" }, startBtn)),
  );
}

// ============ 画面：チャット ============

async function viewChat() {
  const session = await idb.get("current");
  if (!session) return go("#");
  const m = MODES[session.mode];
  let pendingImage = null;
  let sending = false;

  const log = h("div", { class: "log" });
  const textarea = h("textarea", { rows: 1, placeholder: "ここに書いてね", oninput: autosize });
  const pendingBar = h("div", { class: "pending-img", hidden: true });
  const sendBtn = h("button", { class: "btn", onclick: () => send() }, "送る");
  const camInput = h("input", { type: "file", accept: "image/*", onchange: async (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    pendingImage = await shrinkImage(f);
    pendingBar.replaceChildren(h("img", { src: `data:image/jpeg;base64,${pendingImage.data}` }), h("span", {}, "この写真をいっしょに送るよ"),
      h("button", { class: "btn small plain", onclick: () => { pendingImage = null; pendingBar.hidden = true; } }, "けす"));
    pendingBar.hidden = false;
  } });

  function autosize() { textarea.style.height = "auto"; textarea.style.height = Math.min(textarea.scrollHeight, 160) + "px"; }
  const scrollDown = () => requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; window.scrollTo(0, document.body.scrollHeight); });

  function bubbleFor(msg, idx, isLast) {
    if (msg.role === "user") {
      if (idx === 0) {
        if (session.seedLabel) return h("div", { class: "msg setup" }, session.seedLabel);
        const imgs = msg.content.filter((b) => b.type === "image").slice(0, session.setup.problem);
        return h("div", { class: "msg setup" },
          `問題の写真を${session.setup.problem}まい${session.setup.answer ? `、答えの写真を${session.setup.answer}まい` : ""}送ったよ`,
          h("div", { class: "imgs" }, imgs.map((b) => h("img", { src: imgSrc(b), alt: "" }))));
      }
      const blocks = typeof msg.content === "string" ? [{ type: "text", text: msg.content }] : msg.content;
      return h("div", { class: "msg me" }, blocks.map((b) =>
        b.type === "text" ? h("div", { html: renderText(b.text) }) : h("img", { src: imgSrc(b), alt: "" })));
    }
    return aiBubble(msg.content, isLast);
  }

  function aiBubble(raw, isLast, streaming = false) {
    const { text, choices, sims } = parseReply(raw, streaming);
    const el = h("div", { class: "msg ai" });
    el.append(h("div", { html: text ? renderText(text) : '<span class="typing">・・・</span>' }));
    for (const key of sims) el.append(h("button", { class: "sim-open", onclick: () => openSim(key) }, `${SIMS[key].emoji} ${SIMS[key].title}をひらく`));
    if (isLast && !streaming && choices.length) {
      el.append(h("div", { class: "chips" }, choices.map((c) => h("button", { class: "chip", onclick: () => send(c) }, c))));
    }
    return el;
  }

  function renderLog() {
    log.replaceChildren(...session.messages.map((msg, i) => bubbleFor(msg, i, i === session.messages.length - 1)));
    scrollDown();
  }

  function setSending(v) {
    sending = v;
    sendBtn.disabled = v;
    sendBtn.textContent = v ? "…" : "送る";
  }

  async function send(presetText) {
    if (sending) return;
    const text = (presetText ?? textarea.value).trim();
    const last = session.messages[session.messages.length - 1];
    const needsRetry = last.role === "user";
    if (!text && !pendingImage && !needsRetry) return;

    if (text || pendingImage) {
      const blocks = [];
      if (pendingImage) blocks.push({ type: "image", source: { type: "base64", ...pendingImage } });
      blocks.push({ type: "text", text: text || "（写真を送ります）" });
      if (needsRetry) {
        // 前の送信が失敗して user が続く場合は、1つのメッセージにまとめる
        const prev = typeof last.content === "string" ? [{ type: "text", text: last.content }] : last.content;
        last.content = [...prev, ...blocks];
      } else {
        session.messages.push({ role: "user", content: blocks });
      }
      textarea.value = ""; autosize();
      pendingImage = null; pendingBar.hidden = true;
      await idb.set("current", session);
      saveSessionProgress(session);
    }
    renderLog();
    setSending(true);
    let live = aiBubble("", false, true);
    log.append(live);
    scrollDown();
    try {
      const reply = await streamChat(session.apiMode || session.mode, session.messages, (full) => {
        const next = aiBubble(full, false, true);
        live.replaceWith(next);
        live = next;
        scrollDown();
      }, session.mode);
      session.messages.push({ role: "assistant", content: reply });
      await idb.set("current", session);
      saveSessionProgress(session);
      renderLog();
    } catch (e) {
      renderLog();
      log.append(h("div", { class: "msg err" }, e.message, h("div", {},
        h("button", { class: "btn small", style: "margin-top:8px", onclick: () => send() }, "もう一度送る"))));
      scrollDown();
    } finally {
      setSending(false);
    }
  }

  async function finish() {
    const turns = session.messages.filter((x) => x.role === "user").length;
    if (!(await confirmDialog("今日はここまでにする？", "おわる", turns <= 1 ? "まだほとんど話していないけど、おわりにしてもいい？" : "がんばったことを記録するよ"))) return;
    busyDialog("記録をつくっています…");
    let record = null, error = null;
    try { record = await summarizeSession(session); } catch (e) { error = e.message; }
    saveSessionProgress(session); // 会話の中身（返事がまだない場合も含めて）を保存
    const saved = upsertRecord({
      id: session.id, kind: "chat", mode: session.mode, startedAt: session.startedAt, endedAt: new Date().toISOString(),
      turns, hasPhotos: session.setup.problem + session.setup.answer > 0, seedLabel: session.seedLabel || null,
      inProgress: false, stoppedEarly: false,
      ...(record ?? { unit: "（記録の自動作成に失敗）", problem: "", questionType: "", stuckStage: "", nextFocus: "", stumbles: [], achieved: "", hintLevel: null, finalState: "未完成", parentAttention: "high", parentNote: `会話の記録を直接見てください（${error}）`, aiConcerns: "" }),
    });
    await idb.del("current");
    $overlay.replaceChildren(h("div", { class: "dialog" },
      h("h3", {}, "おつかれさま！"),
      h("p", {}, saved ? "今日の学習を記録したよ。「ふりかえり」でいつでも見られるよ。" : "記録の保存に失敗しました。おうちの人に伝えてね。"),
      h("button", { class: "btn wide", onclick: () => { closeOverlay(); go(`#subject/${session.mode}`); } }, "OK")));
  }

  $app.replaceChildren(h("div", { class: "chat" },
    topbar(`${m.emoji} ${m.label}`, `#subject/${session.mode}`,
      session.mode === "rika-tentai" ? h("button", { class: "btn small plain", onclick: pickSim }, "🔭 図") : null,
      h("button", { class: "btn small", onclick: finish }, "おわる")),
    log,
    pendingBar,
    h("div", { class: "composer" },
      h("label", { class: "icon-btn", title: "写真を送る" }, "📷", camInput),
      textarea,
      sendBtn),
  ));
  renderLog();
  // 最後が user（はじめて開いた／前回の送信が失敗）なら、自動で送る
  if (session.messages[session.messages.length - 1].role === "user") send();
}

function pickSim() {
  $overlay.replaceChildren(h("div", { class: "dialog" },
    h("h3", {}, "どの図をひらく？"),
    h("div", { class: "sim-list" }, Object.entries(SIMS).map(([key, s]) =>
      h("button", { class: "link-row", onclick: () => openSim(key) }, h("span", { class: "emoji" }, s.emoji), h("b", {}, s.title)))),
    h("button", { class: "btn plain wide", style: "margin-top:12px", onclick: closeOverlay }, "とじる")));
  $overlay.hidden = false;
}

// ============ ルーター ============

function route() {
  closeOverlay();
  window.scrollTo(0, 0);
  const hash = location.hash || "#";
  if (hash.startsWith("#subject/")) return viewSubject(hash.slice(9));
  if (hash.startsWith("#setup/")) return viewSetup(hash.slice(7));
  if (hash.startsWith("#history/")) return viewHistory(decodeURIComponent(hash.slice(9)));
  if (hash === "#chat") return viewChat();
  if (hash === "#records") return viewRecords();
  if (hash === "#quiz") return viewQuiz();
  if (hash === "#quizmake") return viewQuizMake();
  if (hash === "#sims") return viewSims();
  if (hash === "#tool/kotoba") return viewKotoba();
  if (hash === "#tool/shakai") return viewShakaiQuiz();
  if (hash === "#tool/tokushu") return viewTokushu();
  if (hash.startsWith("#sim/")) { viewSims(); return openSim(hash.slice(5)); }
  return viewHome();
}

setRouter(route);
window.addEventListener("hashchange", route);
route();

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
