import * as moon from "./moon.js";
import * as sun from "./sun.js";
import * as stars from "./stars.js";

// キーは、プロンプトの [[sim:キー]] タグと対応する
export const SIMS = {
  moon: { title: "月の満ち欠け", emoji: "🌙", desc: "月の位置と形、月の出・月の入りの時刻", mount: moon.mount },
  sun: { title: "太陽の動きと影", emoji: "☀️", desc: "季節ごとの太陽の通り道、南中高度、棒の影", mount: sun.mount },
  stars: { title: "北の空の星", emoji: "⭐", desc: "北極星・北斗七星・カシオペヤ座の動き", mount: stars.mount },
};
