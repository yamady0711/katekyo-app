// 月の満ち欠けシミュレーター
// 上から見た図（北極側から見下ろす）。太陽は右側のずっと遠く。
// 角度 θ：地球から見た「太陽の方向」から、反時計回りに測った月の位置（0°=新月、180°=満月）
import { svg, el, rad, mod, fmtTime, slider, svgPoint } from "./util.js";

const C = 200, R_ORBIT = 140, R_EARTH = 42, R_MOON = 15;
const SYNODIC = 29.5;

const pos = (r, a) => [C + r * Math.cos(rad(a)), C - r * Math.sin(rad(a))];

// 反時計回りを示す矢じり
function orbitArrow(r, a, color) {
  const [x, y] = pos(r, a);
  const dx = -Math.sin(rad(a)), dy = -Math.cos(rad(a));
  const nx = dy, ny = -dx;
  const tip = [x + dx * 8, y + dy * 8];
  const b1 = [x - dx * 4 + nx * 5, y - dy * 4 + ny * 5];
  const b2 = [x - dx * 4 - nx * 5, y - dy * 4 - ny * 5];
  return svg("path", { d: `M ${tip} L ${b1} L ${b2} Z`, fill: color });
}

// 地球から見た月の形（南の空に見えるとき）。満ちていく月は右側が光る
export function phasePath(cx, cy, r, theta) {
  const t = mod(theta, 360);
  const waxing = t < 180;
  const k = Math.abs(Math.cos(rad(t)));
  const rx = r * k;
  const top = `${cx} ${cy - r}`, bottom = `${cx} ${cy + r}`;
  const crescent = t < 90 || t > 270;
  if (waxing) {
    return `M ${top} A ${r} ${r} 0 0 1 ${bottom} A ${rx} ${r} 0 0 ${crescent ? 0 : 1} ${top} Z`;
  }
  return `M ${top} A ${r} ${r} 0 0 0 ${bottom} A ${rx} ${r} 0 0 ${crescent ? 1 : 0} ${top} Z`;
}

export function phaseName(theta) {
  const t = mod(theta, 360);
  if (t < 12 || t > 348) return "新月";
  if (t >= 20 && t <= 60) return "三日月";
  if (t >= 78 && t <= 102) return "上弦の月";
  if (t >= 168 && t <= 192) return "満月";
  if (t >= 258 && t <= 282) return "下弦の月";
  if (t < 90) return "新月と上弦のあいだ";
  if (t < 180) return "上弦と満月のあいだ";
  if (t < 270) return "満月と下弦のあいだ";
  return "下弦と新月のあいだ";
}

// 時刻 T（時）に、位置 θ の月が空のどこにあるか
export function moonInSky(theta, T) {
  const phi = (T - 12) * 15; // 観測者の真上の方向（正午に太陽の方向）
  const ha = mod(phi - theta + 180, 360) - 180; // + なら南中を過ぎて西側
  if (Math.abs(ha) > 90) return { up: false, text: "地平線の下（見えない）" };
  let where;
  if (ha < -60) where = "東の空（低い）";
  else if (ha < -20) where = "南東の空";
  else if (ha <= 20) where = "南の空（いちばん高いころ）";
  else if (ha <= 60) where = "南西の空";
  else where = "西の空（低い）";
  const sunUp = mod(T, 24) > 6 && mod(T, 24) < 18;
  const t = mod(theta, 360);
  let note = "";
  if (t < 12 || t > 348) note = "（太陽と同じ方向なので見えない）";
  else if (sunUp) note = "（昼なので見えにくい）";
  return { up: true, text: `${where}${note}` };
}

export function mount(root) {
  let theta = 90;
  let T = 18;

  // ---------- 上から見た図 ----------
  const lightArrows = [70, 130, 200, 270, 330].map((y) =>
    svg("g", {}, svg("line", { x1: 392, y1: y, x2: 352, y2: y, stroke: "#ffd54a", "stroke-width": 2 }),
      svg("path", { d: `M 352 ${y} l 8 -5 v 10 z`, fill: "#ffd54a" })));
  const ghosts = svg("g");
  for (let a = 0; a < 360; a += 45) {
    const [x, y] = pos(R_ORBIT, a);
    const g = svg("g", { opacity: 0.35, style: "cursor:pointer" },
      svg("circle", { cx: x, cy: y, r: 9, fill: "#444" }),
      svg("path", { d: `M ${x} ${y - 9} A 9 9 0 0 1 ${x} ${y + 9} Z`, fill: "#ffe58a" }));
    g.addEventListener("click", () => setTheta(a));
    ghosts.append(g);
  }
  const timeLabels = [[0, "正午"], [90, "夕方6時"], [180, "真夜中"], [270, "明け方6時"]].map(([a, t]) => {
    const [x, y] = pos(R_EARTH + (a % 180 === 0 ? 30 : 32), a);
    return svg("text", { x, y: y + 4, fill: "#cfd6ff", "font-size": 11, "text-anchor": "middle" }, t);
  });
  const observer = svg("g");
  const moonG = svg("g", { style: "cursor:grab" });
  const svgEl = svg("svg", { viewBox: "0 0 400 400", role: "img", "aria-label": "地球と月を上から見た図" },
    lightArrows,
    svg("text", { x: 392, y: 30, fill: "#ffd54a", "font-size": 13, "text-anchor": "end" }, "太陽の光 ←"),
    svg("circle", { cx: C, cy: C, r: R_ORBIT, fill: "none", stroke: "#56608f", "stroke-dasharray": "4 5" }),
    orbitArrow(R_ORBIT, 128, "#8d97c9"),
    svg("text", { x: pos(R_ORBIT + 14, 135)[0], y: pos(R_ORBIT + 14, 135)[1], fill: "#8d97c9", "font-size": 11, "text-anchor": "middle" }, "公転"),
    svg("text", { x: 14, y: 22, fill: "#8d97c9", "font-size": 12 }, "上から見た図（北極側から）"),
    ghosts,
    svg("circle", { cx: C, cy: C, r: R_EARTH, fill: "#1d3b7a" }),
    svg("path", { d: `M ${C} ${C - R_EARTH} A ${R_EARTH} ${R_EARTH} 0 0 1 ${C} ${C + R_EARTH} Z`, fill: "#4f8fe8" }),
    svg("text", { x: C, y: C + 4, fill: "#fff", "font-size": 12, "text-anchor": "middle" }, "地球"),
    timeLabels,
    observer,
    moonG,
  );

  // ---------- 右の情報パネル ----------
  const phaseSvg = svg("svg", { viewBox: "0 0 140 140", width: 140, height: 140, style: "background:#0f1530;border-radius:12px" });
  const nameEl = el("div", { class: "big" });
  const ageEl = el("div", { class: "muted" });
  const riseEl = el("dd"), transitEl = el("dd"), setEl = el("dd"), skyEl = el("dd");
  const panel = el("div", { class: "panel" },
    el("div", { style: "display:flex;gap:12px;align-items:center" }, phaseSvg,
      el("div", {}, el("div", { class: "muted" }, "地球から見た形（南の空）"), nameEl, ageEl)),
    el("dl", {}, el("dt", {}, "月の出"), riseEl, el("dt", {}, "南中"), transitEl, el("dt", {}, "月の入り"), setEl),
    el("dl", {}, el("dt", {}, "その時刻の月"), skyEl));

  const thetaSlider = slider({
    label: "月の位置", min: 0, max: 359, step: 1, value: theta,
    format: (v) => `新月から約${Math.round((v / 360) * SYNODIC * 10) / 10}日`,
    oninput: (v) => { theta = v; draw(); },
  });
  const timeSlider = slider({
    label: "時刻（人の位置）", min: 0, max: 24, step: 0.5, value: T,
    format: (v) => fmtTime(v),
    oninput: (v) => { T = v; draw(); },
  });

  function setTheta(v) { theta = mod(Math.round(v), 360); thetaSlider.set(theta); draw(); }

  const nextDay = el("button", { class: "btn small", onclick: () => setTheta(theta + 360 / SYNODIC) }, "1日すすめる（同じ時刻）");

  function draw() {
    // 月
    const [mx, my] = pos(R_ORBIT, theta);
    moonG.replaceChildren(
      svg("circle", { cx: mx, cy: my, r: R_MOON + 10, fill: "transparent" }),
      svg("circle", { cx: mx, cy: my, r: R_MOON, fill: "#555" }),
      svg("path", { d: `M ${mx} ${my - R_MOON} A ${R_MOON} ${R_MOON} 0 0 1 ${mx} ${my + R_MOON} Z`, fill: "#ffe58a" }),
      svg("text", { x: mx, y: my - R_MOON - 6, fill: "#ffe58a", "font-size": 12, "text-anchor": "middle" }, "月"));

    // 観測者（時刻 T のとき地球上で立っている場所）と地平線
    const phi = (T - 12) * 15;
    const [px, py] = pos(R_EARTH, phi);
    const [hx, hy] = pos(R_EARTH + 12, phi);
    const ex = -Math.sin(rad(phi)), ey = -Math.cos(rad(phi)); // 東向き（画面座標）
    const L = 62;
    observer.replaceChildren(
      svg("line", { x1: px - ex * L, y1: py - ey * L, x2: px + ex * L, y2: py + ey * L, stroke: "#9be29b", "stroke-width": 2, "stroke-dasharray": "5 4" }),
      svg("text", { x: px + ex * (L + 10), y: py + ey * (L + 10) + 4, fill: "#9be29b", "font-size": 12, "text-anchor": "middle" }, "東"),
      svg("text", { x: px - ex * (L + 10), y: py - ey * (L + 10) + 4, fill: "#9be29b", "font-size": 12, "text-anchor": "middle" }, "西"),
      svg("line", { x1: px, y1: py, x2: hx, y2: hy, stroke: "#9be29b", "stroke-width": 3 }),
      svg("circle", { cx: hx, cy: hy, r: 4, fill: "#9be29b" }));

    // 形と時刻
    phaseSvg.replaceChildren(
      svg("circle", { cx: 70, cy: 70, r: 50, fill: "#3a3f55" }),
      svg("path", { d: phasePath(70, 70, 50, theta), fill: "#ffe58a" }));
    nameEl.textContent = phaseName(theta);
    ageEl.textContent = `月齢 約${Math.round((theta / 360) * SYNODIC)}日`;
    const transit = 12 + theta / 15;
    riseEl.textContent = `${fmtTime(transit - 6)}ごろ（東）`;
    transitEl.textContent = `${fmtTime(transit)}ごろ（南）`;
    setEl.textContent = `${fmtTime(transit + 6)}ごろ（西）`;
    skyEl.textContent = `${fmtTime(T)}：${moonInSky(theta, T).text}`;
  }

  // 月をドラッグして動かす
  let dragging = false;
  const onMove = (e) => {
    if (!dragging) return;
    const p = svgPoint(svgEl, e);
    setTheta(mod((Math.atan2(C - p.y, p.x - C) * 180) / Math.PI, 360));
  };
  moonG.addEventListener("pointerdown", (e) => { dragging = true; moonG.setPointerCapture?.(e.pointerId); e.preventDefault(); });
  moonG.addEventListener("pointermove", onMove);
  const stop = () => { dragging = false; };
  moonG.addEventListener("pointerup", stop);
  moonG.addEventListener("pointercancel", stop);

  root.replaceChildren(
    el("div", { class: "sim-grid two" }, svgEl, el("div", {}, panel, thetaSlider, timeSlider, el("div", { class: "row" }, nextDay))),
    el("p", { class: "hint" }, "月（黄色）を指で動かしてみよう。緑の線は、その時刻に立っている人の地平線。線より外側にある月が見えるよ。月は1日に約12°ずつ動き、月の出は毎日約50分おそくなる。"),
  );
  draw();
  return () => {};
}
