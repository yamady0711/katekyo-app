import { WORKER_URL } from "./config.js";
import { SIMS } from "./sims/index.js";

// ============ 設定・保存 ============

const MODES = {
  "kokugo-kijutsu": {
    label: "国語 記述", emoji: "✏️", cls: "kokugo",
    desc: "記述問題の答えを、いっしょに組み立てよう",
    problemHint: "本文・設問がわかるように撮ってね（何まいでもOK）",
  },
  "rika-tentai": {
    label: "理科 天体", emoji: "🌙", cls: "tentai",
    desc: "月・太陽・星の動きを、図を動かして考えよう",
    problemHint: "問題文と図がわかるように撮ってね",
  },
};

const LS = { records: "katekyo.records", pass: "katekyo.pass", worker: "katekyo.worker" };

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
const workerUrl = () => (lsGet(LS.worker, "") || WORKER_URL || "").replace(/\/+$/, "");

// 学習中のセッション（写真入り）は IndexedDB に置き、ページが閉じても続きから再開できるようにする
const idb = {
  db: null,
  async open() {
    if (this.db) return this.db;
    this.db = await new Promise((res, rej) => {
      const r = indexedDB.open("katekyo", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return this.db;
  },
  async run(mode, fn) {
    try {
      const db = await this.open();
      return await new Promise((res, rej) => {
        const tx = db.transaction("kv", mode);
        const req = fn(tx.objectStore("kv"));
        tx.oncomplete = () => res(req?.result);
        tx.onerror = () => rej(tx.error);
      });
    } catch (e) { console.warn("IndexedDB", e); return undefined; }
  },
  get(k) { return this.run("readonly", (s) => s.get(k)); },
  set(k, v) { return this.run("readwrite", (s) => s.put(v, k)); },
  del(k) { return this.run("readwrite", (s) => s.delete(k)); },
};

// ============ ユーティリティ ============

const $app = document.getElementById("app");
const $overlay = document.getElementById("overlay");

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// AIの返事からタグ（[[choices:...]] [[sim:...]]）を取り出し、本文を表示用にする
function parseReply(raw, streaming = false) {
  const choices = [];
  const sims = [];
  let text = raw.replace(/\[\[(choices|sim):([^\]]*)\]\]/g, (_, kind, body) => {
    if (kind === "choices") choices.push(...body.split("|").map((s) => s.trim()).filter(Boolean));
    else if (SIMS[body.trim()]) sims.push(body.trim());
    return "";
  });
  if (streaming) text = text.replace(/\[\[[^\]]*$/, ""); // 書きかけのタグは隠す
  return { text: text.trim(), choices: choices.slice(0, 4), sims: [...new Set(sims)] };
}

function renderText(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
}

const fmtDate = (iso) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}(${"日月火水木金土"[d.getDay()]}) ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// 写真を縮小して JPEG の base64 にする（細かい縦書きの文字も読めるよう、長辺 2000px）
async function shrinkImage(file, maxSide = 2000, quality = 0.85) {
  let bmp;
  try { bmp = await createImageBitmap(file); } catch { bmp = await loadViaImg(file); }
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), hgt = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = hgt;
  canvas.getContext("2d").drawImage(bmp, 0, 0, w, hgt);
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return { media_type: "image/jpeg", data: dataUrl.split(",")[1] };
}
function loadViaImg(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}
const imgSrc = (b) => `data:${b.source.media_type};base64,${b.source.data}`;

// ============ API ============

class ApiError extends Error { constructor(msg, status) { super(msg); this.status = status; } }

async function api(path, body, signal) {
  const base = workerUrl();
  if (!base) throw new ApiError("サーバーのURLが設定されていません。おうちの人ページの「設定」で入れてね", 0);
  let pass = lsGet(LS.pass, "");
  if (!pass) {
    pass = await askPasscode();
    if (!pass) throw new ApiError("合言葉が入っていません", 401);
  }
  let res;
  try {
    res = await fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-App-Pass": pass },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    throw new ApiError("インターネットにつながりませんでした。もう一度送ってね", 0);
  }
  if (res.status === 401) {
    lsSet(LS.pass, "");
    throw new ApiError("合言葉がちがいます。もう一度送ると、入れ直せます", 401);
  }
  if (!res.ok) {
    let msg = "エラーが起きました";
    try { msg = (await res.json()).error || msg; } catch {}
    throw new ApiError(msg, res.status);
  }
  return res;
}

async function streamChat(mode, messages, onText) {
  const res = await api("/api/chat", { mode, messages });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", full = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 2);
      if (!line.startsWith("data:")) continue;
      const ev = JSON.parse(line.slice(5));
      if (ev.t === "text") { full += ev.v; onText(full); }
      else if (ev.t === "error") throw new ApiError(ev.v, 500);
    }
  }
  if (!full.trim()) throw new ApiError("返事がうまく届きませんでした。もう一度送ってね", 500);
  return full;
}

// ============ ダイアログ ============

function closeOverlay() { $overlay.hidden = true; $overlay.replaceChildren(); }

function askPasscode() {
  return new Promise((resolve) => {
    const input = h("input", { type: "password", autocomplete: "off", placeholder: "合言葉" });
    const done = (v) => { closeOverlay(); if (v) lsSet(LS.pass, v); resolve(v); };
    $overlay.replaceChildren(h("div", { class: "dialog" },
      h("h3", {}, "合言葉を入れてね"),
      h("p", { class: "muted" }, "おうちの人に聞いてね。この端末に保存されます。"),
      input,
      h("div", { class: "row" },
        h("button", { class: "btn plain", onclick: () => done("") }, "やめる"),
        h("button", { class: "btn", onclick: () => done(input.value.trim()) }, "OK")),
    ));
    $overlay.hidden = false;
    input.focus();
  });
}

function confirmDialog(title, okLabel = "OK", body = "") {
  return new Promise((resolve) => {
    const done = (v) => { closeOverlay(); resolve(v); };
    $overlay.replaceChildren(h("div", { class: "dialog" },
      h("h3", {}, title),
      body ? h("p", { class: "muted" }, body) : null,
      h("div", { class: "row" },
        h("button", { class: "btn plain", onclick: () => done(false) }, "もどる"),
        h("button", { class: "btn", onclick: () => done(true) }, okLabel)),
    ));
    $overlay.hidden = false;
  });
}

function openSim(key) {
  const sim = SIMS[key];
  if (!sim) return;
  const body = h("div", { class: "body sim" });
  let cleanup = null;
  const close = () => { cleanup?.(); closeOverlay(); };
  $overlay.replaceChildren(h("div", { class: "sheet" },
    h("div", { class: "topbar" },
      h("h1", {}, `${sim.emoji} ${sim.title}`),
      h("button", { class: "btn small", onclick: close }, "とじる")),
    body));
  $overlay.hidden = false;
  cleanup = sim.mount(body);
}

// ============ 画面：ホーム ============

async function viewHome() {
  const current = await idb.get("current");
  $app.replaceChildren(h("div", { class: "page" },
    h("div", { class: "hero" },
      h("div", { class: "logo" }, "かてきょ"),
      h("div", { class: "muted" }, "苦手なところを、いっしょに考えよう")),
    current ? h("div", { class: "resume" },
      h("span", {}, `とちゅうの学習があります（${MODES[current.mode]?.label ?? ""}・${fmtDate(current.startedAt)}）`),
      h("button", { class: "btn small", onclick: () => go("#chat") }, "つづける"),
      h("button", { class: "btn small plain", onclick: async () => {
        if (await confirmDialog("とちゅうの学習をすてる？", "すてる", "記録は残りません")) { await idb.del("current"); viewHome(); }
      } }, "すてる")) : null,
    h("div", { class: "modes" },
      Object.entries(MODES).map(([key, m]) => h("button", {
        class: `mode-card ${m.cls}`,
        onclick: async () => {
          if (current && !(await confirmDialog("とちゅうの学習があるよ。新しく始める？", "新しく始める", "とちゅうの学習は消えます"))) return;
          await idb.del("current");
          go(`#setup/${key}`);
        },
      }, h("span", { class: "emoji" }, m.emoji), h("span", { class: "name" }, m.label), h("span", { class: "desc" }, m.desc)))),
    h("div", { class: "links" },
      h("button", { class: "link-row", onclick: () => go("#sims") },
        h("span", { class: "emoji" }, "🔭"), h("span", {}, h("b", {}, "天体の図で調べる"), h("span", { class: "muted" }, "月・太陽・星を自由に動かせるよ"))),
      h("button", { class: "link-row", onclick: () => go("#records") },
        h("span", { class: "emoji" }, "📒"), h("span", {}, h("b", {}, "記録（おうちの人）"), h("span", { class: "muted" }, "つまずきの記録・設定")))),
  ));
}

function viewSims() {
  $app.replaceChildren(
    h("div", { class: "topbar" }, h("button", { class: "btn small plain", onclick: () => go("#") }, "← もどる"), h("h1", {}, "天体の図で調べる")),
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
  const refresh = () => { startBtn.disabled = busy > 0 || photos.problem.length === 0; startBtn.textContent = busy ? "写真を準備中…" : "はじめる"; };

  function section(kind, title, hint) {
    const thumbs = h("div", { class: "thumbs" });
    const redraw = () => {
      thumbs.replaceChildren(...photos[kind].map((p, i) => h("div", { class: "thumb" },
        h("img", { src: `data:${p.media_type};base64,${p.data}`, alt: "" }),
        h("button", { "aria-label": "けす", onclick: () => { photos[kind].splice(i, 1); redraw(); refresh(); } }, "×"))));
    };
    const input = h("input", { type: "file", accept: "image/*", multiple: true, onchange: async (e) => {
      const files = [...e.target.files];
      e.target.value = "";
      busy += files.length; refresh();
      for (const f of files) {
        try { photos[kind].push(await shrinkImage(f)); } catch (err) { alert("この写真は読みこめませんでした"); }
        busy--; redraw(); refresh();
      }
    } });
    return h("div", { class: "photo-section" },
      h("h3", {}, title), h("div", { class: "muted" }, hint), thumbs,
      h("label", { class: "btn ghost small file-btn" }, "📷 写真を追加", input));
  }

  async function start() {
    const content = [{ type: "text", text: "【塾の問題の写真】" }];
    for (const p of photos.problem) content.push({ type: "image", source: { type: "base64", ...p } });
    if (photos.answer.length) {
      content.push({ type: "text", text: "【塾の模範解答の写真】（子どもには見せないこと）" });
      for (const p of photos.answer) content.push({ type: "image", source: { type: "base64", ...p } });
    } else {
      content.push({ type: "text", text: "（模範解答の写真はありません）" });
    }
    content.push({ type: "text", text: "この問題を教えてください。" });
    const session = {
      id: crypto.randomUUID?.() ?? String(Date.now()),
      mode, startedAt: new Date().toISOString(),
      setup: { problem: photos.problem.length, answer: photos.answer.length },
      messages: [{ role: "user", content }],
    };
    await idb.set("current", session);
    go("#chat");
  }

  $app.replaceChildren(
    h("div", { class: "topbar" }, h("button", { class: "btn small plain", onclick: () => go("#") }, "← もどる"), h("h1", {}, `${m.emoji} ${m.label}`)),
    h("div", { class: "page" },
      section("problem", "① 問題の写真", m.problemHint),
      section("answer", "② 答えの写真（あれば）", "塾の模範解答。きみには見せずに、先生が答え合わせに使うよ"),
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
      if (text) blocks.push({ type: "text", text });
      if (!text) blocks.push({ type: "text", text: "（写真を送ります）" });
      if (needsRetry && session.messages.length > 1) {
        // 前の送信が失敗して user が続く場合は、1つのメッセージにまとめる
        const prev = typeof last.content === "string" ? [{ type: "text", text: last.content }] : last.content;
        last.content = [...prev, ...blocks];
      } else if (needsRetry) {
        last.content = [...last.content, ...blocks];
      } else {
        session.messages.push({ role: "user", content: blocks });
      }
      textarea.value = ""; autosize();
      pendingImage = null; pendingBar.hidden = true;
      await idb.set("current", session);
    }
    renderLog();
    setSending(true);
    let live = aiBubble("", false, true);
    log.append(live);
    scrollDown();
    try {
      const reply = await streamChat(session.mode, session.messages, (full) => {
        const next = aiBubble(full, false, true);
        live.replaceWith(next);
        live = next;
        scrollDown();
      });
      session.messages.push({ role: "assistant", content: reply });
      await idb.set("current", session);
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
    $overlay.replaceChildren(h("div", { class: "dialog" }, h("h3", {}, "記録をつくっています…"), h("p", { class: "muted" }, "少し待ってね")));
    $overlay.hidden = false;
    const textOnly = session.messages.map((x) => ({
      role: x.role,
      content: typeof x.content === "string" ? x.content : x.content.map((b) => (b.type === "text" ? b : { type: "text", text: "［写真］" })),
    }));
    // 最後が user のまま（送信失敗）なら、その発言は記録用に残しつつ形をそろえる
    if (textOnly[textOnly.length - 1].role === "user" && textOnly.length > 1) textOnly.push({ role: "assistant", content: "（返事なし）" });
    let record = null, error = null;
    try {
      const res = await api("/api/summary", { mode: session.mode, messages: textOnly });
      record = (await res.json()).record;
    } catch (e) { error = e.message; }
    const transcript = textOnly.slice(1).map((x) => {
      const t = typeof x.content === "string" ? x.content : x.content.map((b) => b.text).join("\n");
      return `${x.role === "user" ? "子ども" : "先生"}: ${x.role === "assistant" ? parseReply(t).text : t}`;
    }).join("\n\n");
    const records = lsGet(LS.records, []);
    records.unshift({
      id: session.id, mode: session.mode, startedAt: session.startedAt, endedAt: new Date().toISOString(),
      turns, ...(record ?? { unit: "（記録の自動作成に失敗）", problem: "", stumbles: [], achieved: "", hintLevel: null, finalState: "未完成", parentAttention: "high", parentNote: `会話の記録を直接見てください（${error}）`, aiConcerns: "" }),
      transcript,
    });
    const saved = lsSet(LS.records, records);
    await idb.del("current");
    $overlay.replaceChildren(h("div", { class: "dialog" },
      h("h3", {}, "おつかれさま！"),
      h("p", {}, saved ? "今日の学習を記録したよ。" : "記録の保存に失敗しました。おうちの人に伝えてね。"),
      h("button", { class: "btn wide", onclick: () => { closeOverlay(); go("#"); } }, "ホームへ")));
  }

  $app.replaceChildren(h("div", { class: "chat" },
    h("div", { class: "topbar" },
      h("button", { class: "btn small plain", onclick: () => go("#") }, "← ホーム"),
      h("h1", {}, `${m.emoji} ${m.label}`),
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

// ============ 画面：記録（おうちの人） ============

function viewRecords() {
  let filter = "all";
  const list = h("div");
  const filters = h("div", { class: "filters" });

  function draw() {
    const records = lsGet(LS.records, []);
    const shown = records.filter((r) => filter === "all" || r.parentAttention === filter || r.mode === filter);
    filters.replaceChildren(...[
      ["all", `すべて (${records.length})`], ["high", "要確認"], ["medium", "ヒントで完成"], ["low", "自力"],
      ...Object.entries(MODES).map(([k, m]) => [k, m.label]),
    ].map(([k, label]) => h("button", { class: `chip ${filter === k ? "on" : ""}`, onclick: () => { filter = k; draw(); } }, label)));
    if (!shown.length) { list.replaceChildren(h("p", { class: "muted" }, "まだ記録はありません。")); return; }
    list.replaceChildren(...shown.map((r) => h("div", { class: "record" },
      h("div", { class: "head" },
        h("span", { class: `badge ${r.parentAttention}` }, { high: "要確認", medium: "ヒントで完成", low: "自力でOK" }[r.parentAttention] ?? r.parentAttention),
        h("span", { class: "badge mode" }, MODES[r.mode]?.label ?? r.mode),
        h("span", { class: "date" }, `${fmtDate(r.startedAt)}・${r.finalState}${r.hintLevel != null ? `・ヒント段階${r.hintLevel}` : ""}`)),
      h("div", { class: "unit" }, r.unit),
      r.problem ? h("div", { class: "muted" }, r.problem) : null,
      r.stumbles?.length ? h("div", {}, h("b", {}, "つまずき"), h("ul", {}, r.stumbles.map((s) => h("li", {}, s)))) : null,
      r.achieved ? h("div", {}, h("b", {}, "できたこと："), r.achieved) : null,
      r.parentNote ? h("div", { class: "note" }, "👨 ", r.parentNote) : null,
      r.aiConcerns ? h("div", { class: "concern" }, "⚠️ AIの不安：", r.aiConcerns) : null,
      h("details", {}, h("summary", {}, "会話を見る"), h("pre", {}, r.transcript || "")),
      h("div", { class: "row" }, h("button", { class: "btn small plain", onclick: async () => {
        if (!(await confirmDialog("この記録を消す？", "消す"))) return;
        lsSet(LS.records, lsGet(LS.records, []).filter((x) => x.id !== r.id)); draw();
      } }, "消す")),
    )));
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(lsGet(LS.records, []), null, 2)], { type: "application/json" });
    const a = h("a", { href: URL.createObjectURL(blob), download: `katekyo-records-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a); a.click(); a.remove();
  }
  const importInput = h("input", { type: "file", accept: "application/json,.json", hidden: true, onchange: async (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    try {
      const incoming = JSON.parse(await f.text());
      if (!Array.isArray(incoming)) throw new Error();
      const map = new Map(lsGet(LS.records, []).map((r) => [r.id, r]));
      for (const r of incoming) if (r?.id) map.set(r.id, r);
      const merged = [...map.values()].sort((a, b) => (b.startedAt > a.startedAt ? 1 : -1));
      lsSet(LS.records, merged); draw();
      alert(`${incoming.length}件を読みこみました`);
    } catch { alert("読みこめませんでした"); }
  } });

  const urlInput = h("input", { type: "url", value: lsGet(LS.worker, "") || WORKER_URL, placeholder: "https://katekyo-worker.xxx.workers.dev" });
  const passInput = h("input", { type: "password", value: lsGet(LS.pass, ""), placeholder: "合言葉" });

  $app.replaceChildren(
    h("div", { class: "topbar" }, h("button", { class: "btn small plain", onclick: () => go("#") }, "← もどる"), h("h1", {}, "記録（おうちの人）")),
    h("div", { class: "page" },
      filters, list,
      h("h2", {}, "バックアップ"),
      h("p", { class: "muted" }, "記録はこの端末のブラウザの中にだけ保存されています。ときどき書き出しておくと安心です。"),
      h("div", { class: "row" },
        h("button", { class: "btn small", onclick: exportJson }, "書き出す（JSON）"),
        h("button", { class: "btn small ghost", onclick: () => importInput.click() }, "読みこむ"), importInput),
      h("h2", {}, "設定"),
      h("div", { class: "settings" },
        h("label", {}, "サーバー（Worker）のURL", urlInput),
        h("label", {}, "合言葉", passInput),
        h("div", { class: "row" }, h("button", { class: "btn small", onclick: () => {
          lsSet(LS.worker, urlInput.value.trim()); lsSet(LS.pass, passInput.value.trim()); alert("保存しました");
        } }, "保存")))),
  );
  draw();
}

// ============ ルーター ============

function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }

function route() {
  closeOverlay();
  const hash = location.hash || "#";
  if (hash.startsWith("#setup/")) return viewSetup(hash.slice(7));
  if (hash === "#chat") return viewChat();
  if (hash === "#records") return viewRecords();
  if (hash === "#sims") return viewSims();
  if (hash.startsWith("#sim/")) { viewSims(); return openSim(hash.slice(5)); }
  return viewHome();
}

window.addEventListener("hashchange", route);
route();

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
