const NS = "http://www.w3.org/2000/svg";

export function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const c of children.flat()) if (c != null) el.append(c.nodeType ? c : String(c));
  return el;
}

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "class") e.className = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : String(c));
  return e;
}

export const rad = (d) => (d * Math.PI) / 180;
export const deg = (r) => (r * 180) / Math.PI;
export const mod = (a, n) => ((a % n) + n) % n;

// 時刻（小数の時間）→「18時30分」
export function fmtTime(hours) {
  let t = mod(hours, 24);
  let hh = Math.floor(t);
  let mm = Math.round((t - hh) * 60);
  if (mm === 60) { hh = (hh + 1) % 24; mm = 0; }
  return mm === 0 ? `${hh}時` : `${hh}時${String(mm).padStart(2, "0")}分`;
}

// 方位角（北=0、東=90、時計回り）→ 16方位
export function dir16(az) {
  const names = ["北", "北北東", "北東", "東北東", "東", "東南東", "南東", "南南東", "南", "南南西", "南西", "西南西", "西", "西北西", "北西", "北北西"];
  return names[Math.round(mod(az, 360) / 22.5) % 16];
}

// スライダー部品
export function slider({ label, min, max, step, value, format, oninput }) {
  const out = el("span", {}, format(value));
  const input = el("input", { type: "range", min, max, step, value });
  input.addEventListener("input", () => { out.textContent = format(Number(input.value)); oninput(Number(input.value)); });
  const wrap = el("div", { class: "ctrl" }, el("label", {}, el("span", {}, label), out), input);
  wrap.set = (v) => { input.value = v; out.textContent = format(v); };
  return wrap;
}

// 切りかえボタン部品
export function segmented(options, value, onchange) {
  const wrap = el("div", { class: "seg" });
  const draw = () => {
    wrap.replaceChildren(...options.map(([v, label]) =>
      el("button", { class: v === value ? "on" : "", onclick: () => { value = v; draw(); onchange(v); } }, label)));
  };
  draw();
  return wrap;
}

// SVG 上のポインター位置（viewBox 座標）
export function svgPoint(svgEl, evt) {
  const pt = svgEl.createSVGPoint();
  pt.x = evt.clientX; pt.y = evt.clientY;
  return pt.matrixTransform(svgEl.getScreenCTM().inverse());
}
