// 北の空の星の動き（北極星・北斗七星・カシオペヤ座）
// 北を向いて立ったときの空。北極星を中心に、1時間で15°、同じ時刻なら1か月で30°、反時計回りに動く
import { svg, el, rad, mod, fmtTime, slider } from "./util.js";

const PX = 200, PY = 150, K = 3.0; // 北極星の位置と、1° あたりの長さ
const MID_DOY = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349];

// [名前, 赤経(時), 赤緯(度)]
const DIPPER = [["ドゥーベ", 11.06, 61.75], ["メラク", 11.03, 56.38], ["フェクダ", 11.9, 53.69], ["メグレズ", 12.26, 57.03], ["アリオト", 12.9, 55.96], ["ミザール", 13.4, 54.93], ["アルカイド", 13.79, 49.31]];
const DIPPER_LINES = [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]];
const CASSIOPEIA = [["カフ", 0.15, 59.15], ["シェダル", 0.68, 56.54], ["ガンマ", 0.95, 60.72], ["ルクバー", 1.43, 60.24], ["セギン", 1.91, 63.67]];
const CASS_LINES = [[0, 1], [1, 2], [2, 3], [3, 4]];

// 背景の星（固定の乱数）
const BG = (() => {
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 70 }, () => [r() * 24, 40 + r() * 50, 0.6 + r() * 0.9]);
})();

function lst(month, T) {
  return T + ((MID_DOY[month - 1] - 265) * 24) / 365.25;
}
function place(ra, dec, month, T) {
  const ha = rad((lst(month, T) - ra) * 15);
  const r = (90 - dec) * K;
  return [PX - r * Math.sin(ha), PY - r * Math.cos(ha)];
}
function sideOf(x, y) {
  const a = mod((Math.atan2(PY - y, x - PX) * 180) / Math.PI, 360); // 画面上で右=0、反時計回り
  const names = ["右", "右上", "上", "左上", "左", "左下", "下", "右下"];
  return names[Math.round(a / 45) % 8];
}

export function mount(root, opts = {}) {
  let month = 4, T = 20, trail = true, lat = 35;
  const scene = svg("g");
  const svgEl = svg("svg", { viewBox: "0 0 400 330", role: "img", "aria-label": "北の空の星" }, scene);
  const info = el("dl");

  const monthSlider = slider({ label: "月（同じ時刻で比べる）", min: 1, max: 12, step: 1, value: month, format: (v) => `${v}月15日ごろ`, oninput: (v) => { month = v; draw(); } });
  const timeSlider = slider({ label: "時刻", min: 18, max: 30, step: 0.5, value: T, format: (v) => (v >= 24 ? `翌${fmtTime(v)}` : fmtTime(v)), oninput: (v) => { T = v; draw(); } });
  const trailBox = el("input", { type: "checkbox", checked: true, onchange: (e) => { trail = e.target.checked; draw(); } });

  function constellation(stars, lines, m, t, color, opacity, labelText) {
    const pts = stars.map(([, ra, dec]) => place(ra, dec, m, t));
    const g = svg("g", { opacity });
    for (const [a, b] of lines) g.append(svg("line", { x1: pts[a][0], y1: pts[a][1], x2: pts[b][0], y2: pts[b][1], stroke: color, "stroke-width": 1.5 }));
    for (const [x, y] of pts) g.append(svg("circle", { cx: x, cy: y, r: 3.2, fill: "#fff" }));
    if (labelText) {
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      g.append(svg("text", { x: cx, y: cy - 14, fill: color, "font-size": 12, "text-anchor": "middle" }, labelText));
    }
    return { g, pts };
  }

  function draw() {
    const horizonY = PY + lat * K;
    const items = [];
    for (const [ra, dec, size] of BG) {
      const [x, y] = place(ra, dec, month, T);
      items.push(svg("circle", { cx: x, cy: y, r: size, fill: "#aab4e8", opacity: 0.6 }));
    }
    // 1時間ごとの角度の目安（北極星中心の円）
    items.push(svg("circle", { cx: PX, cy: PY, r: 32 * K, fill: "none", stroke: "#2c3766", "stroke-dasharray": "3 5" }));

    if (trail) {
      for (let t = 18; t < T - 0.01; t += 2) {
        items.push(constellation(DIPPER, DIPPER_LINES, month, t, "#7fb8ff", 0.25).g);
        items.push(constellation(CASSIOPEIA, CASS_LINES, month, t, "#ff9ad5", 0.25).g);
      }
    }
    const dip = constellation(DIPPER, DIPPER_LINES, month, T, "#7fb8ff", 1, "北斗七星");
    const cas = constellation(CASSIOPEIA, CASS_LINES, month, T, "#ff9ad5", 1, "カシオペヤ座");
    items.push(dip.g, cas.g);

    // 北極星
    items.push(svg("circle", { cx: PX, cy: PY, r: 5, fill: "#ffe680" }));
    items.push(svg("text", { x: PX + 9, y: PY + 4, fill: "#ffe680", "font-size": 13 }, "北極星"));

    // 地面
    items.push(svg("rect", { x: 0, y: horizonY, width: 400, height: 330 - horizonY, fill: "#14301f", opacity: 0.92 }));
    items.push(svg("line", { x1: 0, y1: horizonY, x2: 400, y2: horizonY, stroke: "#5fbf7f", "stroke-width": 2 }));
    items.push(svg("text", { x: PX, y: horizonY + 22, fill: "#fff", "font-size": 16, "font-weight": 700, "text-anchor": "middle" }, "北"));
    items.push(svg("text", { x: 388, y: horizonY + 22, fill: "#cfe", "font-size": 13, "text-anchor": "end" }, "東 →"));
    items.push(svg("text", { x: 12, y: horizonY + 22, fill: "#cfe", "font-size": 13 }, "← 西"));
    // 北極星の高さ
    items.push(svg("line", { x1: PX, y1: PY, x2: 372, y2: PY, stroke: "#ffe680", "stroke-dasharray": "2 3", opacity: 0.35 }));
    items.push(svg("line", { x1: 372, y1: horizonY, x2: 372, y2: PY, stroke: "#ffe680", "stroke-width": 1.5, opacity: 0.8 }));
    items.push(svg("text", { x: 366, y: (horizonY + PY) / 2, fill: "#ffe680", "font-size": 11, "text-anchor": "end", opacity: 0.9 }, `北極星の高さ${lat}°`));

    // 回転の向き
    items.push(svg("path", { d: `M ${PX + 22} ${PY - 22} A 31 31 0 0 0 ${PX - 22} ${PY - 22}`, fill: "none", stroke: "#ffe680", "stroke-width": 1.5, opacity: 0.7 }));
    items.push(svg("path", { d: `M ${PX - 22} ${PY - 22} l 1 9 l 7 -6 z`, fill: "#ffe680", opacity: 0.7 }));
    scene.replaceChildren(...items);

    const center = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
    const [dx, dy] = center(dip.pts), [cx, cy] = center(cas.pts);
    const below = (pts) => pts.filter(([, y]) => y > horizonY).length;
    info.replaceChildren(
      el("dt", {}, "北斗七星"), el("dd", {}, `北極星の${sideOf(dx, dy)}${below(dip.pts) ? `（${below(dip.pts)}個が地平線の下）` : ""}`),
      el("dt", {}, "カシオペヤ座"), el("dd", {}, `北極星の${sideOf(cx, cy)}${below(cas.pts) ? `（${below(cas.pts)}個が地平線の下）` : ""}`),
      el("dt", {}, "20時から"), el("dd", {}, T === 20 ? "—" : T > 20 ? `${T - 20}時間後 → ${(T - 20) * 15}° 反時計回り` : `${20 - T}時間前（${(20 - T) * 15}° 手前）`));
  }

  root.replaceChildren(
    el("div", { class: "sim-grid two" }, svgEl, el("div", {}, el("div", { class: "panel" }, el("div", { class: "big" }, "北の空"), info), timeSlider, monthSlider,
      el("label", { class: "ctrl", style: "display:flex;gap:8px;align-items:center;font-weight:700" }, trailBox, "18時から2時間ごとの位置を残す"))),
    el("p", { class: "hint" }, "北の空の星は、北極星を中心に1時間で15°、反時計回りに動くよ。同じ時刻に見ると、1か月で30°動く。北極星の高さは、その場所の緯度（東京は約35°）と同じ。"),
  );
  draw();
  return () => {};
}
