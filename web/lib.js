// 共通部品：保存・API・画面部品
import { WORKER_URL } from "./config.js";
import { SIMS } from "./sims/index.js";

// ============ 設定・保存 ============

export const MODES = {
  "kokugo-kijutsu": {
    label: "国語 記述", emoji: "✏️", cls: "kokugo",
    desc: "記述問題の答えを、いっしょに組み立てよう",
    problemHint: "本文・設問がわかるように撮ってね（何まいでもOK）",
  },
  "sansu-baai": {
    label: "算数 場合の数・規則性", emoji: "🔢", cls: "sansu",
    desc: "書き出し方と数え方を、身につけよう",
    problemHint: "問題文と図がわかるように撮ってね",
  },
  "rika-tentai": {
    label: "理科 天体", emoji: "🌙", cls: "tentai",
    desc: "月・太陽・星の動きを、図を動かして考えよう",
    problemHint: "問題文と図がわかるように撮ってね",
  },
  "chiri": {
    label: "社会 地理", emoji: "🗾", cls: "chiri",
    desc: "「なぜ？」とクイズで、理由ごと覚えよう",
    problemHint: "問題文・地図・表がわかるように撮ってね",
  },
};

export const LS = { records: "katekyo.records", pass: "katekyo.pass", worker: "katekyo.worker", deck: "katekyo.deck" };

export function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
}
export function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
export const workerUrl = () => (lsGet(LS.worker, "") || WORKER_URL || "").replace(/\/+$/, "");

// 学習中のセッション（写真入り）は IndexedDB に置き、ページが閉じても続きから再開できるようにする
export const idb = {
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

export const $app = document.getElementById("app");
export const $overlay = document.getElementById("overlay");

export function h(tag, attrs = {}, ...children) {
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

export function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// AIの返事からタグ（[[choices:...]] [[sim:...]]）を取り出し、本文を表示用にする
export function parseReply(raw, streaming = false) {
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

export function renderText(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
}

export const fmtDate = (iso) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}(${"日月火水木金土"[d.getDay()]}) ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// 写真を縮小して JPEG の base64 にする（細かい縦書きの文字も読めるよう、長辺 2000px）
export async function shrinkImage(file, maxSide = 2000, quality = 0.85) {
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
export const imgSrc = (b) => `data:${b.source.media_type};base64,${b.source.data}`;

// ============ API ============

export class ApiError extends Error { constructor(msg, status) { super(msg); this.status = status; } }

export async function api(path, body, signal) {
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

export async function streamChat(mode, messages, onText) {
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

export function closeOverlay() { $overlay.hidden = true; $overlay.replaceChildren(); }

export function askPasscode() {
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

export function confirmDialog(title, okLabel = "OK", body = "") {
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

export function openSim(key) {
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

// ============ ルーター・共通の画面部品 ============

let router = () => {};
export function setRouter(fn) { router = fn; }
export function go(hash) { if (location.hash === hash) router(); else location.hash = hash; }

export function topbar(title, back = "#", ...right) {
  return h("div", { class: "topbar" },
    h("button", { class: "btn small plain", onclick: () => (typeof back === "function" ? back() : go(back)) }, "← もどる"),
    h("h1", {}, title), ...right);
}

export function toast(msg) {
  const t = h("div", { class: "toast" }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 2200);
}

export function busyDialog(title, body = "少し待ってね") {
  $overlay.replaceChildren(h("div", { class: "dialog" }, h("h3", {}, title), h("p", { class: "muted" }, body)));
  $overlay.hidden = false;
}

export function showImage(src) {
  $overlay.replaceChildren(h("div", { class: "sheet" },
    h("div", { class: "topbar" }, h("h1", {}, "写真"), h("button", { class: "btn small", onclick: closeOverlay }, "とじる")),
    h("div", { class: "body" }, h("img", { src, style: "width:100%;border-radius:12px" }))));
  $overlay.hidden = false;
}

// ============ 記録 ============

export const getRecords = () => lsGet(LS.records, []);
export function addRecord(rec) {
  const records = getRecords();
  records.unshift(rec);
  return lsSet(LS.records, records);
}
export const findRecord = (id) => getRecords().find((r) => r.id === id);
export function deleteRecord(id) {
  lsSet(LS.records, getRecords().filter((r) => r.id !== id));
  idb.del(`photos:${id}`);
}
export const newId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// 新しい学習の最初に添える「これまでの記録」（同じ科目の直近3回）
export function historyContext(mode) {
  const recent = getRecords().filter((r) => r.mode === mode && r.kind !== "quiz").slice(0, 3);
  if (!recent.length) return "";
  const lines = recent.map((r) => {
    const d = new Date(r.startedAt);
    const parts = [`${d.getMonth() + 1}/${d.getDate()} ${r.unit || ""}（${r.finalState || ""}）`];
    if (r.stumbles?.length) parts.push(`つまずき：${r.stumbles.slice(0, 2).join("／")}`);
    if (r.nextFocus) parts.push(`次回の重点：${r.nextFocus}`);
    return "- " + parts.join("。");
  });
  return `【これまでの記録（参考）】\n${lines.join("\n")}`.slice(0, 1500);
}

// 写真を使った学習セッションを作って保存する
export async function startSession(mode, { problem = [], answer = [] }, opts = {}) {
  const content = [];
  const ctx = historyContext(mode);
  if (ctx) content.push({ type: "text", text: ctx });
  if (opts.seedText) {
    content.push({ type: "text", text: opts.seedText });
  } else {
    content.push({ type: "text", text: "【塾の問題の写真】" });
    for (const p of problem) content.push({ type: "image", source: { type: "base64", ...p } });
    if (answer.length) {
      content.push({ type: "text", text: "【塾の模範解答の写真】（子どもには見せないこと）" });
      for (const p of answer) content.push({ type: "image", source: { type: "base64", ...p } });
    } else {
      content.push({ type: "text", text: "（模範解答の写真はありません）" });
    }
    content.push({ type: "text", text: "この問題を教えてください。" });
  }
  const session = {
    id: newId(), mode, startedAt: new Date().toISOString(),
    setup: { problem: problem.length, answer: answer.length },
    seedLabel: opts.seedLabel || null,
    messages: [{ role: "user", content }],
  };
  await idb.set("current", session);
  return session;
}

// 写真を追加する欄（縮小して list に入れる）。onChange(+n) で準備中、(-1) で1枚完了、(0) で削除
export function photoSection(list, title, hint, onChange) {
  const thumbs = h("div", { class: "thumbs" });
  const redraw = () => {
    thumbs.replaceChildren(...list.map((p, i) => h("div", { class: "thumb" },
      h("img", { src: `data:${p.media_type};base64,${p.data}`, alt: "" }),
      h("button", { "aria-label": "けす", onclick: () => { list.splice(i, 1); redraw(); onChange(0); } }, "×"))));
  };
  const input = h("input", { type: "file", accept: "image/*", multiple: true, onchange: async (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    onChange(files.length);
    for (const f of files) {
      try { list.push(await shrinkImage(f)); } catch { alert("この写真は読みこめませんでした"); }
      redraw(); onChange(-1);
    }
  } });
  return h("div", { class: "photo-section" },
    h("h3", {}, title), h("div", { class: "muted" }, hint), thumbs,
    h("label", { class: "btn ghost small file-btn" }, "📷 写真を追加", input));
}

