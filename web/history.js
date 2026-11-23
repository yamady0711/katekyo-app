// ふりかえり（子ども向け）と、記録（おうちの人向け）
import { WORKER_URL } from "./config.js";
import {
  MODES, LS, lsGet, lsSet, idb, h, renderText, fmtDate, $app, confirmDialog, go, topbar, showImage,
  getRecords, findRecord, deleteRecord, startSession,
} from "./lib.js";
import { usageSection, overBudget } from "./usage.js";

const STATE_ICON = { "自力で完成": "🌟", "ヒントで完成": "⭕", "未完成": "🔁" };

// 科目ページの「ふりかえり」一覧の1行
export function historyRow(r) {
  const isQuiz = r.kind === "quiz";
  const title = isQuiz ? `${r.unit || "クイズ"} ${r.score}/${r.total}問正解` : r.unit || "（記録）";
  const sub = isQuiz
    ? (r.wrong?.length ? `まちがえた：${r.wrong.map((w) => w.answer).slice(0, 3).join("、")}` : "全問正解！")
    : (r.nextFocus ? `つぎ：${r.nextFocus}` : r.achieved || "");
  return h("button", { class: "history-row", onclick: () => go(`#history/${encodeURIComponent(r.id)}`) },
    h("span", { class: "icon" }, isQuiz ? "🃏" : STATE_ICON[r.finalState] ?? "📄"),
    h("span", { class: "main" }, h("span", { class: "date" }, fmtDate(r.startedAt)), h("b", {}, title), sub ? h("span", { class: "muted sub" }, sub) : null),
    h("span", { class: "chev" }, "›"));
}

function conversation(r) {
  if (r.log?.length) {
    return h("div", { class: "log static" }, r.log.map((x) =>
      h("div", { class: `msg ${x.role === "user" ? "me" : "ai"}`, html: renderText(x.text || "") })));
  }
  return h("pre", { class: "transcript" }, r.transcript || "（会話の記録はありません）");
}

// ============ ふりかえり：1回分の詳しい記録 ============

export async function viewHistory(id) {
  const r = findRecord(id);
  if (!r) return go("#");
  const m = MODES[r.mode] ?? { label: r.mode, emoji: "📄" };
  const back = `#subject/${r.mode}`;
  const body = h("div", { class: "page" });
  $app.replaceChildren(topbar(`${m.emoji} ふりかえり`, back), body);

  const head = h("div", { class: "record" },
    h("div", { class: "head" }, h("span", { class: "badge mode" }, m.label), h("span", { class: "date" }, fmtDate(r.startedAt))),
    h("div", { class: "unit" }, r.kind === "quiz" ? `${r.unit || "クイズ"} ${r.score}/${r.total}問正解` : r.unit),
    r.problem ? h("div", { class: "muted" }, r.problem) : null,
    r.seedLabel ? h("div", { class: "muted" }, r.seedLabel) : null);
  body.append(head);

  if (r.kind === "quiz") {
    if (!r.wrong?.length) body.append(h("p", {}, "全問正解でした！🌟"));
    else {
      body.append(h("h2", {}, "まちがえた問題"));
      for (const w of r.wrong) {
        body.append(h("div", { class: "record" },
          h("div", { class: "muted" }, w.unit || ""),
          h("div", { class: "unit" }, w.question),
          h("div", {}, "答え：", h("b", {}, w.answer), w.chosen ? h("span", { class: "muted" }, `（きみの答え：${w.chosen}）`) : null),
          w.why ? h("div", { class: "note" }, "💡 ", w.why) : null,
          h("div", { class: "row" }, h("button", { class: "btn small", onclick: () => askWhy(w, r.mode, r.askMode ?? "chiri") }, "🤔 なぜ？を先生に聞く"))));
      }
    }
    return;
  }

  // 学習（対話）の記録
  head.append(...[
    h("div", { class: "row" }, h("span", { class: "state" }, `${STATE_ICON[r.finalState] ?? ""} ${r.finalState ?? ""}`)),
    r.achieved ? h("div", { class: "good" }, h("b", {}, "できたこと："), r.achieved) : null,
    r.stumbles?.length ? h("div", {}, h("b", {}, "むずかしかったこと"), h("ul", {}, r.stumbles.map((s) => h("li", {}, s)))) : null,
    r.nextFocus ? h("div", { class: "note" }, h("b", {}, "つぎに気をつけること："), r.nextFocus) : null,
  ].filter(Boolean));

  const photos = r.hasPhotos ? await idb.get(`photos:${r.id}`) : null;
  if (photos?.images?.length) {
    const problemImgs = photos.images.slice(0, photos.setup?.problem ?? photos.images.length);
    body.append(
      h("h2", {}, "問題"),
      h("div", { class: "thumbs" }, problemImgs.map((src) => {
        const url = `data:${src.media_type};base64,${src.data}`;
        return h("button", { class: "thumb", onclick: () => showImage(url) }, h("img", { src: url, alt: "" }));
      })),
      h("button", { class: "btn wide", onclick: () => retry(r, photos) }, "📷 この問題をもう一度やる"));
  }
  body.append(h("h2", {}, "会話"), conversation(r));
}

async function retry(r, photos) {
  const current = await idb.get("current");
  if (current && !(await confirmDialog("とちゅうの学習があるよ。この問題を始める？", "始める", "とちゅうの学習は消えます"))) return;
  const n = photos.setup?.problem ?? photos.images.length;
  const toPhoto = (s) => ({ media_type: s.media_type, data: s.data });
  await startSession(r.mode, { problem: photos.images.slice(0, n).map(toPhoto), answer: photos.images.slice(n).map(toPhoto) });
  go("#chat");
}

// クイズでまちがえた問題について、先生と「なぜ」を話す
// askMode "chiri"：地理カード（地理の対話で）／"tool"：かんたんクイズ・特殊算（ふりかえり用のプロンプトで）
export async function askWhy(w, mode = "chiri", askMode = "chiri") {
  const current = await idb.get("current");
  if (current && !(await confirmDialog("とちゅうの学習があるよ。この問題を始める？", "始める", "とちゅうの学習は消えます"))) return;
  if (askMode === "chiri") {
    const seedText = `【地理クイズでまちがえた問題】\n問題：${w.question}\n正解：${w.answer}\n${w.chosen ? `ぼくの答え：${w.chosen}\n` : ""}テキストにもとづく説明：${w.why || "（なし）"}\n\nなぜそうなるのか、いっしょに考えたいです。`;
    await startSession("chiri", {}, { seedText, seedLabel: `クイズでまちがえた問題：${w.question}` });
  } else {
    const subject = MODES[mode]?.label ?? "";
    const seedText = `【${subject}・${w.unit || "かんたんクイズ"}でまちがえた問題】\n問題：${w.question}\n正解：${w.answer}\n${w.chosen ? `ぼくの答え：${w.chosen}\n` : ""}アプリの解説：${w.why || "（なし）"}\n\nどうしてまちがえたのか、いっしょに考えたいです。`;
    await startSession(mode, {}, { seedText, seedLabel: `まちがえた問題：${w.question}`, apiMode: "tool-help" });
  }
  go("#chat");
}

// ============ 記録（おうちの人） ============

export function viewRecords() {
  let filter = "all";
  const list = h("div");
  const filters = h("div", { class: "filters" });

  function card(r) {
    const isQuiz = r.kind === "quiz";
    return h("div", { class: "record" },
      h("div", { class: "head" },
        h("span", { class: `badge ${r.parentAttention}` }, { high: "要確認", medium: "ヒントで完成", low: "自力でOK" }[r.parentAttention] ?? r.parentAttention),
        h("span", { class: "badge mode" }, MODES[r.mode]?.label ?? r.mode),
        h("span", { class: "date" }, `${fmtDate(r.startedAt)}${isQuiz ? "" : `・${r.finalState}`}`)),
      h("div", { class: "unit" }, isQuiz ? `${r.unit || "クイズ"} ${r.score}/${r.total}問正解` : r.unit),
      r.problem ? h("div", { class: "muted" }, r.problem) : null,
      !isQuiz && (r.questionType || r.stuckStage) ? h("div", {}, h("b", {}, "設問の型："), r.questionType || "—", "　", h("b", {}, "つまずいた段階："), r.stuckStage || "—") : null,
      r.stumbles?.length ? h("div", {}, h("b", {}, isQuiz ? "まちがえた問題" : "つまずき"), h("ul", {}, r.stumbles.map((s) => h("li", {}, s)))) : null,
      r.achieved ? h("div", {}, h("b", {}, "できたこと："), r.achieved) : null,
      r.nextFocus ? h("div", {}, h("b", {}, "次回の重点："), r.nextFocus) : null,
      r.parentNote ? h("div", { class: "note" }, "👨 ", r.parentNote) : null,
      r.aiConcerns ? h("div", { class: "concern" }, "⚠️ AIの不安：", r.aiConcerns) : null,
      h("div", { class: "row" },
        h("button", { class: "btn small ghost", onclick: () => go(`#history/${encodeURIComponent(r.id)}`) }, isQuiz ? "くわしく見る" : "会話・写真を見る"),
        h("button", { class: "btn small plain", onclick: async () => {
          if (!(await confirmDialog("この記録を消す？", "消す"))) return;
          deleteRecord(r.id); draw();
        } }, "消す")));
  }

  function draw() {
    const records = getRecords();
    const shown = records.filter((r) => filter === "all" || r.parentAttention === filter || r.mode === filter);
    filters.replaceChildren(...[
      ["all", `すべて (${records.length})`], ["high", "要確認"], ["medium", "ヒントで完成"], ["low", "自力"],
      ...Object.entries(MODES).map(([k, m]) => [k, m.label]),
    ].map(([k, label]) => h("button", { class: `chip ${filter === k ? "on" : ""}`, onclick: () => { filter = k; draw(); } }, label)));
    list.replaceChildren(...(shown.length ? shown.map(card) : [h("p", { class: "muted" }, "まだ記録はありません。")]));
  }

  function exportJson() {
    const data = { version: 3, records: getRecords(), deck: lsGet(LS.deck, []), bank: lsGet(LS.bank, {}), usage: lsGet(LS.usage, []) };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = h("a", { href: URL.createObjectURL(blob), download: `katekyo-backup-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a); a.click(); a.remove();
  }
  const mergeById = (current, incoming) => {
    const map = new Map(current.map((x) => [x.id, x]));
    for (const x of incoming) if (x?.id) map.set(x.id, x);
    return [...map.values()];
  };
  const importInput = h("input", { type: "file", accept: "application/json,.json", hidden: true, onchange: async (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const records = Array.isArray(data) ? data : data.records;
      if (!Array.isArray(records)) throw new Error();
      lsSet(LS.records, mergeById(getRecords(), records).sort((a, b) => (b.startedAt > a.startedAt ? 1 : -1)));
      if (Array.isArray(data.deck)) lsSet(LS.deck, mergeById(lsGet(LS.deck, []), data.deck));
      if (data.bank && typeof data.bank === "object") lsSet(LS.bank, { ...data.bank, ...lsGet(LS.bank, {}) });
      if (Array.isArray(data.usage)) {
        const key = (e) => `${e.date}|${e.mode}`;
        const map = new Map(data.usage.map((e) => [key(e), e]));
        for (const e of lsGet(LS.usage, [])) map.set(key(e), e); // この端末の記録を優先
        lsSet(LS.usage, [...map.values()]);
      }
      draw();
      alert(`記録${records.length}件${data.deck ? `・クイズ${data.deck.length}枚` : ""}を読みこみました`);
    } catch { alert("読みこめませんでした"); }
  } });

  const urlInput = h("input", { type: "url", value: lsGet(LS.worker, "") || WORKER_URL, placeholder: "https://katekyo-worker.xxx.workers.dev" });
  const passInput = h("input", { type: "password", value: lsGet(LS.pass, ""), placeholder: "合言葉" });

  $app.replaceChildren(
    topbar("記録（おうちの人）", "#"),
    h("div", { class: "page" },
      overBudget() ? h("button", { class: "usage-alert over wide-alert", onclick: () => document.getElementById("usage")?.scrollIntoView({ behavior: "smooth" }) },
        "⚠️ 今月のAI使用量が目安をこえました（下の「AIの使用量」を見てください）") : null,
      filters, list,
      h("h2", { id: "usage" }, "AIの使用量"),
      usageSection(),
      h("h2", {}, "バックアップ"),
      h("p", { class: "muted" }, "記録・クイズカード・AIの使用量は、この端末のブラウザの中にだけ保存されています（問題の写真は含まれません）。ときどき書き出しておくと安心です。"),
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
