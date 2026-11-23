// 太陽の1日の動き（透明半球）と棒の影
// 座標：x=東、y=北、z=上。半球の半径 1。南中を12時とする（太陽時）
import { svg, el, rad, deg, mod, fmtTime, dir16, slider, segmented } from "./util.js";

const TILT = 23.4;
const SEASONS = [["summer", "夏至", TILT], ["equinox", "春分・秋分", 0], ["winter", "冬至", -TILT]];
const S = 150, CX = 200, CY = 215, YAW = rad(12), ELEV = rad(22);
const STICK = 0.22;

function project([x, y, z]) {
  const X = x * Math.cos(YAW) - y * Math.sin(YAW);
  const Y = x * Math.sin(YAW) + y * Math.cos(YAW);
  return [CX + S * X, CY - S * (z * Math.cos(ELEV) + Y * Math.sin(ELEV))];
}
const pt = (p) => project(p).map((v) => v.toFixed(1)).join(",");

// 太陽の方向ベクトル（緯度 lat、赤緯 dec、時刻 T）
export function sunVector(lat, dec, T) {
  const H = rad((T - 12) * 15), L = rad(lat), d = rad(dec);
  return [
    -Math.cos(d) * Math.sin(H),
    Math.cos(L) * Math.sin(d) - Math.sin(L) * Math.cos(d) * Math.cos(H),
    Math.sin(L) * Math.sin(d) + Math.cos(L) * Math.cos(d) * Math.cos(H),
  ];
}

export function dayInfo(lat, dec) {
  const c = -Math.tan(rad(lat)) * Math.tan(rad(dec));
  const H0 = deg(Math.acos(Math.max(-1, Math.min(1, c))));
  const riseAz = deg(Math.acos(Math.max(-1, Math.min(1, Math.sin(rad(dec)) / Math.cos(rad(lat))))));
  return { rise: 12 - H0 / 15, set: 12 + H0 / 15, length: (2 * H0) / 15, riseAz, setAz: 360 - riseAz, noonAlt: 90 - lat + dec };
}

export function mount(root) {
  let season = "summer", lat = 35, T = 9, timer = null;
  const decOf = () => SEASONS.find((s) => s[0] === season)[2];

  const scene = svg("g");
  const svgEl = svg("svg", { viewBox: "0 0 400 300", role: "img", "aria-label": "透明半球と太陽の通り道" }, scene);

  const info = el("dl");
  const nowInfo = el("dl");
  const panel = el("div", { class: "panel" }, el("div", { class: "big", id: "sun-title" }), info, el("hr", { style: "border:none;border-top:1px solid #dde" }), nowInfo);

  const timeSlider = slider({ label: "時刻", min: 4, max: 20, step: 0.25, value: T, format: fmtTime, oninput: (v) => { T = v; draw(); } });
  const latSlider = slider({ label: "緯度（北緯）", min: 20, max: 45, step: 1, value: lat, format: (v) => `${v}°${v === 35 ? "（東京あたり）" : ""}`, oninput: (v) => { lat = v; draw(); } });
  const seasonSeg = segmented(SEASONS.map(([k, l]) => [k, l]), season, (v) => { season = v; draw(); });
  const playBtn = el("button", { class: "btn small", onclick: togglePlay }, "▶ 動かす");

  function togglePlay() {
    if (timer) { clearInterval(timer); timer = null; playBtn.textContent = "▶ 動かす"; return; }
    playBtn.textContent = "■ 止める";
    timer = setInterval(() => { T = T >= 20 ? 4 : Math.round((T + 0.1) * 100) / 100; timeSlider.set(Math.round(T * 4) / 4); draw(); }, 60);
  }

  function pathFor(dec) {
    const pts = [];
    for (let t = 0; t <= 24; t += 0.1) {
      const v = sunVector(lat, dec, t);
      if (v[2] >= -0.001) pts.push(pt(v));
    }
    return pts.join(" ");
  }

  function draw() {
    const dec = decOf();
    const items = [];
    // 地面（円）と方位
    const ground = [];
    for (let a = 0; a <= 360; a += 5) ground.push(pt([Math.cos(rad(a)), Math.sin(rad(a)), 0]));
    items.push(svg("polygon", { points: ground.join(" "), fill: "#26304f", stroke: "#7f8bc0", "stroke-width": 1.5 }));
    items.push(svg("line", { x1: project([-1, 0, 0])[0], y1: project([-1, 0, 0])[1], x2: project([1, 0, 0])[0], y2: project([1, 0, 0])[1], stroke: "#4a5585" }));
    items.push(svg("line", { x1: project([0, -1, 0])[0], y1: project([0, -1, 0])[1], x2: project([0, 1, 0])[0], y2: project([0, 1, 0])[1], stroke: "#4a5585" }));
    for (const [label, p] of [["東", [1.13, 0, 0]], ["西", [-1.13, 0, 0]], ["南", [0, -1.15, 0]], ["北", [0, 1.12, 0]]]) {
      const [x, y] = project(p);
      items.push(svg("text", { x, y: y + 5, fill: "#fff", "font-size": 15, "font-weight": 700, "text-anchor": "middle" }, label));
    }
    // 半球の輪かく
    items.push(svg("path", { d: `M ${CX - S} ${CY} A ${S} ${S} 0 0 1 ${CX + S} ${CY}`, fill: "rgba(160,190,255,0.06)", stroke: "#7f8bc0", "stroke-dasharray": "4 4" }));

    // 季節ごとの太陽の通り道
    for (const [k, label, d] of SEASONS) {
      const on = k === season;
      items.push(svg("polyline", { points: pathFor(d), fill: "none", stroke: on ? "#ffb02e" : "rgba(255,255,255,0.28)", "stroke-width": on ? 3 : 1.5 }));
      const [nx, ny] = project(sunVector(lat, d, 12));
      items.push(svg("text", { x: nx + 6, y: ny - 6, fill: on ? "#ffb02e" : "rgba(255,255,255,0.5)", "font-size": 12 }, label));
    }

    // 棒と影
    const v = sunVector(lat, dec, T);
    const base = project([0, 0, 0]), topP = project([0, 0, STICK]);
    let shadowTxt = "なし（太陽がしずんでいる）";
    if (v[2] > 0.01) {
      // 影の先の通り道
      const trail = [];
      for (let t = 0; t <= 24; t += 0.2) {
        const w = sunVector(lat, dec, t);
        if (w[2] < Math.sin(rad(6))) continue;
        const sx = (-w[0] / w[2]) * STICK, sy = (-w[1] / w[2]) * STICK;
        if (Math.hypot(sx, sy) < 0.95) trail.push(pt([sx, sy, 0]));
      }
      items.push(svg("polyline", { points: trail.join(" "), fill: "none", stroke: "#9aa3c7", "stroke-dasharray": "3 4" }));
      let sx = (-v[0] / v[2]) * STICK, sy = (-v[1] / v[2]) * STICK;
      const len = Math.hypot(sx, sy);
      const ratio = len / STICK;
      if (len > 0.95) { sx *= 0.95 / len; sy *= 0.95 / len; }
      const tip = project([sx, sy, 0]);
      items.push(svg("line", { x1: base[0], y1: base[1], x2: tip[0], y2: tip[1], stroke: "#0b0f1f", "stroke-width": 5, "stroke-linecap": "round" }));
      const shadowAz = deg(Math.atan2(-v[0], -v[1]));
      shadowTxt = `${dir16(shadowAz)}向き・棒の約${ratio.toFixed(1)}倍`;
    }
    items.push(svg("line", { x1: base[0], y1: base[1], x2: topP[0], y2: topP[1], stroke: "#e9e2c8", "stroke-width": 4, "stroke-linecap": "round" }));

    // 太陽
    if (v[2] > -0.001) {
      const [x, y] = project(v);
      items.push(svg("line", { x1: base[0], y1: base[1], x2: x, y2: y, stroke: "rgba(255,210,80,0.45)", "stroke-dasharray": "2 4" }));
      items.push(svg("circle", { cx: x, cy: y, r: 10, fill: "#ffcf33", stroke: "#fff3b0", "stroke-width": 2 }));
    }
    items.push(svg("text", { x: 12, y: 22, fill: "#8d97c9", "font-size": 12 }, "南から見た透明半球"));
    scene.replaceChildren(...items);

    // 情報
    const d = dayInfo(lat, dec);
    const label = SEASONS.find((s) => s[0] === season)[1];
    panel.querySelector("#sun-title").textContent = `${label}の日（北緯${lat}°）`;
    const riseDir = d.riseAz < 88 ? "真東より北より" : d.riseAz > 92 ? "真東より南より" : "真東";
    const setDir = d.riseAz < 88 ? "真西より北より" : d.riseAz > 92 ? "真西より南より" : "真西";
    info.replaceChildren(
      el("dt", {}, "南中高度"), el("dd", {}, `${d.noonAlt.toFixed(1)}°`),
      el("dt", {}, "日の出"), el("dd", {}, `${fmtTime(d.rise)}ごろ・${riseDir}`),
      el("dt", {}, "日の入り"), el("dd", {}, `${fmtTime(d.set)}ごろ・${setDir}`),
      el("dt", {}, "昼の長さ"), el("dd", {}, `約${Math.floor(d.length)}時間${Math.round((d.length % 1) * 60)}分`));
    const alt = deg(Math.asin(Math.max(-1, Math.min(1, v[2]))));
    const az = deg(Math.atan2(v[0], v[1]));
    nowInfo.replaceChildren(
      el("dt", {}, "時刻"), el("dd", {}, fmtTime(T)),
      el("dt", {}, "太陽"), el("dd", {}, v[2] > 0 ? `${dir16(az)}・高さ${alt.toFixed(0)}°` : "しずんでいる"),
      el("dt", {}, "棒の影"), el("dd", {}, shadowTxt));
  }

  root.replaceChildren(
    el("div", { class: "sim-grid two" }, svgEl, el("div", {}, panel)),
    el("div", { class: "ctrl" }, el("label", {}, "季節"), seasonSeg),
    timeSlider,
    el("div", { class: "row" }, playBtn),
    latSlider,
    el("p", { class: "hint" }, "時刻は「南中＝12時」としたときの時刻です。南中高度は、春分・秋分＝90°−緯度、夏至はそれより23.4°高く、冬至は23.4°低くなります。点線は、1日の影の先の動きです。"),
  );
  draw();
  return () => { if (timer) clearInterval(timer); };
}
