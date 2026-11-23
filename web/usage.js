// AIの使用量（トークン）と概算料金：おうちの人ページに表示する
import { MODES, LS, lsGet, lsSet, h } from "./lib.js";

// Claude Opus 5.5 の料金（米ドル / 100万トークン）。料金が変わったらここを直す
export const PRICE = { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 };
const BUDGET_KEY = "katekyo.budget";

const LABELS = { ...Object.fromEntries(Object.entries(MODES).map(([k, m]) => [k, m.label])) };

export const costOf = (e) =>
  (e.input * PRICE.input + e.output * PRICE.output + e.cacheWrite * PRICE.cacheWrite + e.cacheRead * PRICE.cacheRead) / 1e6;

const usd = (v) => (v < 0.01 && v > 0 ? "$0.01未満" : `$${v.toFixed(2)}`);
const tok = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));
const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const ymd = (d) => `${ym(d)}-${String(d.getDate()).padStart(2, "0")}`;

function sum(entries) {
  const t = { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  for (const e of entries) for (const k of Object.keys(t)) t[k] += e[k] ?? 0;
  return t;
}

function barRow(label, value, max, valueText, title) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return h("div", { class: "ubar", title },
    h("span", { class: "ubar-label" }, label),
    h("span", { class: "ubar-track" }, h("span", { class: "ubar-fill", style: `width:${value > 0 ? pct : 0}%` })),
    h("span", { class: "ubar-value" }, valueText));
}

export function usageSection() {
  const wrap = h("div", { class: "usage" });

  function draw() {
    const ledger = lsGet(LS.usage, []);
    const now = new Date();
    const thisMonth = ym(now);
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = ledger.filter((e) => e.date.startsWith(thisMonth));
    const last = ledger.filter((e) => e.date.startsWith(ym(lastMonthDate)));
    const mt = sum(month), lt = sum(last);
    const mCost = costOf(mt);
    const budget = Number(lsGet(BUDGET_KEY, 0)) || 0;
    const over = budget > 0 && mCost >= budget;
    const near = budget > 0 && !over && mCost >= budget * 0.8;

    // 直近14日
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = ymd(d);
      const t = sum(ledger.filter((e) => e.date === key));
      days.push({ key, label: `${d.getMonth() + 1}/${d.getDate()}`, cost: costOf(t), t });
    }
    const dayMax = Math.max(...days.map((d) => d.cost));

    // 科目別（今月）
    const byMode = Object.entries(
      month.reduce((acc, e) => { (acc[e.mode] ??= []).push(e); return acc; }, {}),
    ).map(([mode, es]) => { const t = sum(es); return { mode, t, cost: costOf(t) }; }).sort((a, b) => b.cost - a.cost);
    const modeMax = Math.max(0, ...byMode.map((x) => x.cost));

    const budgetInput = h("input", { type: "number", min: "0", step: "1", value: budget || "", placeholder: "例：10", class: "budget-input" });

    wrap.replaceChildren(
      over || near ? h("div", { class: `usage-alert ${over ? "over" : ""}` },
        over ? `⚠️ 今月の概算（${usd(mCost)}）が、目安の $${budget} をこえました。` : `今月の概算（${usd(mCost)}）が、目安 $${budget} の8割をこえました。`) : null,
      h("div", { class: "usage-hero" },
        h("div", {}, h("div", { class: "muted" }, `今月（${now.getMonth() + 1}月）の概算`), h("div", { class: "usage-big" }, usd(mCost)),
          h("div", { class: "muted" }, `${mt.calls}回の呼び出し・先月 ${usd(costOf(lt))}`)),
        budget > 0 ? h("div", { class: "usage-meter", title: `目安 $${budget} に対して ${Math.round((mCost / budget) * 100)}%` },
          h("div", { class: "muted" }, `月の目安 $${budget}`),
          h("div", { class: "ubar-track big" }, h("span", { class: `ubar-fill ${over ? "over" : ""}`, style: `width:${Math.min(100, (mCost / budget) * 100)}%` }))) : null),
      h("h3", {}, "直近14日（1日ごとの概算）"),
      h("div", { class: "ubars" }, days.map((d) => barRow(d.label, d.cost, dayMax, d.cost ? usd(d.cost) : "—",
        `${d.label}：${usd(d.cost)}（入力 ${tok(d.t.input)}・出力 ${tok(d.t.output)}・キャッシュ読み ${tok(d.t.cacheRead)}・呼び出し ${d.t.calls}回）`))),
      h("h3", {}, "科目別（今月）"),
      byMode.length
        ? h("div", { class: "ubars" }, byMode.map((x) => barRow(LABELS[x.mode] ?? x.mode, x.cost, modeMax,
            `${usd(x.cost)}（${x.t.calls}回）`, `入力 ${tok(x.t.input)}・出力 ${tok(x.t.output)}・キャッシュ書き ${tok(x.t.cacheWrite)}・キャッシュ読み ${tok(x.t.cacheRead)}`)))
        : h("p", { class: "muted" }, "今月はまだ使っていません。"),
      h("details", { class: "usage-detail" }, h("summary", {}, "今月のトークン数の内訳"),
        h("dl", {},
          h("dt", {}, "入力"), h("dd", {}, `${mt.input.toLocaleString()}（$${PRICE.input}/100万）`),
          h("dt", {}, "出力（考える分を含む）"), h("dd", {}, `${mt.output.toLocaleString()}（$${PRICE.output}/100万）`),
          h("dt", {}, "キャッシュ書きこみ"), h("dd", {}, `${mt.cacheWrite.toLocaleString()}（$${PRICE.cacheWrite}/100万）`),
          h("dt", {}, "キャッシュ読みこみ"), h("dd", {}, `${mt.cacheRead.toLocaleString()}（$${PRICE.cacheRead}/100万）`))),
      h("div", { class: "row" },
        h("label", { class: "budget-label" }, "月の目安（ドル）", budgetInput),
        h("button", { class: "btn small", onclick: () => { lsSet(BUDGET_KEY, Number(budgetInput.value) || 0); draw(); } }, "保存")),
      h("p", { class: "muted" }, "この端末で使った分だけの概算です（ほかの端末の分や、料金の細かい計算は入りません）。正確な請求額は Anthropic Console の「Usage」「Cost」で確認してください。"),
    );
  }

  draw();
  return wrap;
}

// 今月の概算が目安をこえているか（ホームなどで使う）
export function overBudget() {
  const budget = Number(lsGet(BUDGET_KEY, 0)) || 0;
  if (!budget) return false;
  const thisMonth = ym(new Date());
  return costOf(sum(lsGet(LS.usage, []).filter((e) => e.date.startsWith(thisMonth)))) >= budget;
}
