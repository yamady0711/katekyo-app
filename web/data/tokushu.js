// 算数：特殊算の練習問題を、数字を変えて自動でつくる
// 答えはプログラムで計算する（AIは計算をまちがえることがあるため）
// 解き方は中学受験の方法（面積図・線分図・表）。方程式は使わない

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const TOKUSHU_TYPES = [
  ["tsurukame", "つるかめ算"],
  ["wasa", "和差算"],
  ["tabibito", "旅人算"],
  ["ueki", "植木算"],
  ["nenrei", "年齢算"],
  ["kabusoku", "過不足算"],
];

const GEN = {
  tsurukame() {
    const v = pick([
      { a: "つる", b: "かめ", ua: "羽", ub: "匹", pa: 2, pb: 4, what: "足", unitT: "本", head: "頭の数" },
      { a: "10円玉", b: "50円玉", ua: "枚", ub: "枚", pa: 10, pb: 50, what: "金額", unitT: "円", head: "枚数" },
      { a: "1個80円のりんご", b: "1個120円のなし", ua: "個", ub: "個", pa: 80, pb: 120, what: "代金", unitT: "円", head: "個数" },
    ]);
    const nb = ri(3, 12), na = ri(3, 12), N = na + nb;
    const T = v.pa * na + v.pb * nb;
    const short = (s) => s.replace(/^1個\d+円の/, "");
    const A = short(v.a), B = short(v.b);
    const q = v.a === "つる"
      ? `つるとかめが合わせて${N}${"匹"}います。足の数は合わせて${T}本です。かめは何匹いますか。`
      : `${v.a}と${v.b}を合わせて${N}${v.ua}${v.a.includes("円玉") ? "持っていて" : "買うと"}、${v.what}は合わせて${T}円${v.a.includes("円玉") ? "です" : "でした"}。${B}は何${v.ub}ですか。`;
    const allA = v.pa * N;
    return {
      q, answer: nb, unit: v.ub,
      hints: [
        `ぜんぶ${A}だったとしたら、${v.what}はいくつになる？`,
        `本当の${v.what}（${T}${v.unitT}）と、ぜんぶ${A}のとき（${allA}${v.unitT}）の差は？`,
        `${A}を${B}に1つかえると、${v.what}は${v.pb - v.pa}${v.unitT}ふえるよ。差を何回ふやせばいい？`,
      ],
      solution: [
        `ぜんぶ${A}だとすると：${v.pa}×${N}＝${allA}（${v.unitT}）`,
        `本当との差：${T}−${allA}＝${T - allA}（${v.unitT}）`,
        `${A}1つを${B}1つにかえると ${v.pb}−${v.pa}＝${v.pb - v.pa}（${v.unitT}）ふえる`,
        `${B}の数：${T - allA}÷${v.pb - v.pa}＝${nb}（${v.ub}）`,
        `面積図でかくと、たて＝1つあたり、横＝数、面積＝合計。へこんだ部分を考えるのと同じだよ。`,
      ],
    };
  },

  wasa() {
    const v = pick([
      { big: "兄", small: "弟", thing: "持っているお金", u: "円", step: 10, lo: 30, hi: 150 },
      { big: "長いテープ", small: "短いテープ", thing: "長さ", u: "cm", step: 1, lo: 8, hi: 60 },
      { big: "姉", small: "妹", thing: "持っているカード", u: "枚", step: 1, lo: 5, hi: 40 },
    ]);
    const s = ri(v.lo, v.hi) * v.step;
    const d = ri(1, Math.max(2, Math.floor(v.hi / 3))) * v.step;
    const b = s + d, sum = b + s;
    const askBig = Math.random() < 0.5;
    const target = askBig ? v.big : v.small;
    return {
      q: `${v.big}と${v.small}の${v.thing}は、合わせて${sum}${v.u}です。${v.big}は${v.small}より${d}${v.u}多いです。${target}は何${v.u}ですか。`,
      answer: askBig ? b : s, unit: v.u,
      hints: [
        "線分図をかいてみよう。2本の線を上下にならべて、長いほうと短いほうの差をかきこむよ。",
        askBig ? `${v.small}にも${d}${v.u}たして、${v.big}と同じにすると、合計はいくつになる？` : `${v.big}から${d}${v.u}ひいて、${v.small}と同じにすると、合計はいくつになる？`,
        askBig ? "その合計は、何人（何本）分になっている？" : "その合計は、何人（何本）分になっている？",
      ],
      solution: askBig
        ? [`${v.small}に差の${d}${v.u}をたすと、2つとも${v.big}と同じ：${sum}＋${d}＝${sum + d}`, `${v.big}は：${sum + d}÷2＝${b}（${v.u}）`, `「（和＋差）÷2＝大きいほう」`]
        : [`${v.big}から差の${d}${v.u}をひくと、2つとも${v.small}と同じ：${sum}−${d}＝${sum - d}`, `${v.small}は：${sum - d}÷2＝${s}（${v.u}）`, `「（和−差）÷2＝小さいほう」`],
    };
  },

  tabibito() {
    if (Math.random() < 0.5) {
      // 出会い
      const a = ri(4, 8) * 10, b = ri(4, 9) * 10, t = ri(5, 20), D = (a + b) * t;
      return {
        q: `${D}mはなれたところにいるAさんとBさんが、向かい合って同時に歩き始めました。Aさんは分速${a}m、Bさんは分速${b}mで歩きます。2人が出会うのは歩き始めてから何分後ですか。`,
        answer: t, unit: "分後",
        hints: [
          "線分図をかいて、2人が1分間に動くようすを考えよう。",
          "向かい合って進むとき、2人の間のきょりは1分間にどれだけちぢまる？",
          `1分間に ${a}＋${b}m ずつちぢまるよ。${D}mがなくなるのは何分後？`,
        ],
        solution: [`1分間に2人の間は ${a}＋${b}＝${a + b}（m）ちぢまる`, `${D}÷${a + b}＝${t}（分後）`, `「出会い＝速さの和」`],
      };
    }
    // 追いかけ
    let a, d, k, t;
    do {
      a = ri(5, 8) * 10; d = ri(1, 4) * 10; k = ri(3, 15);
      t = (a * k) / d;
    } while (!Number.isInteger(t) || t > 40 || t < 3);
    const b = a + d;
    return {
      q: `弟が家を出て分速${a}mで歩き始めました。その${k}分後に、兄が分速${b}mで同じ道を追いかけました。兄が弟に追いつくのは、兄が出発してから何分後ですか。`,
      answer: t, unit: "分後",
      hints: [
        `兄が出発するとき、弟はもう何m先にいる？`,
        "同じ向きに進むとき、2人の間のきょりは1分間にどれだけちぢまる？",
        `1分間に ${b}−${a}m ずつちぢまるよ。はじめの差がなくなるのは何分後？`,
      ],
      solution: [`兄が出発するとき弟は ${a}×${k}＝${a * k}（m）先にいる`, `1分間に ${b}−${a}＝${d}（m）ずつちぢまる`, `${a * k}÷${d}＝${t}（分後）`, `「追いかけ＝速さの差」`],
    };
  },

  ueki() {
    const kind = pick(["both", "none", "circle"]);
    const g = pick([2, 3, 4, 5, 6, 8, 10]);
    const n = ri(5, 25);
    const L = g * n;
    const texts = {
      both: [`長さ${L}mのまっすぐな道の片側に、はしからはしまで${g}mおきに木を植えます。両はしにも植えるとき、木は何本いりますか。`, n + 1, "両はしに植えるとき、木の数＝間の数＋1"],
      none: [`長さ${L}mのまっすぐな道の片側に、${g}mおきに木を植えます。両はしには植えないとき、木は何本いりますか。`, n - 1, "両はしに植えないとき、木の数＝間の数−1"],
      circle: [`まわりの長さが${L}mの池のまわりに、${g}mおきに木を植えます。木は何本いりますか。`, n, "池のまわり（円の形）では、木の数＝間の数"],
    };
    const [q, ans, rule] = texts[kind];
    return {
      q, answer: ans, unit: "本",
      hints: [
        "まず、木と木の「間」がいくつあるかを考えよう。",
        `間の数は ${L}÷${g} で求められるね。`,
        "短い道（たとえば間が2つ）で図をかいて、木の数と間の数をくらべてみよう。",
      ],
      solution: [`間の数：${L}÷${g}＝${n}`, rule, `${ans}（本）`],
    };
  },

  nenrei() {
    let y, c, k, f;
    do {
      y = ri(1, 12); c = ri(2, 12); k = pick([2, 3, 4]);
      f = k * (c + y) - y;
    } while (f < 28 || f > 52 || f - c < 22);
    return {
      q: `今、父は${f}才、子どもは${c}才です。父の年れいが子どもの年れいの${k}倍になるのは、今から何年後ですか。`,
      answer: y, unit: "年後",
      hints: [
        "何年たっても、父と子どもの年れいの差は変わらないよ。差はいくつ？",
        `父が子どもの${k}倍になるとき、線分図で表すと、差は子どもの年れいの何こ分？`,
        `差が「子ども${k - 1}こ分」だから、そのときの子どもの年れいがわかるね。`,
      ],
      solution: [
        `年れいの差：${f}−${c}＝${f - c}（才）（何年たっても同じ）`,
        `${k}倍のとき、差は子どもの年れいの ${k}−1＝${k - 1}（こ分）`,
        `そのときの子ども：${f - c}÷${k - 1}＝${c + y}（才）`,
        `${c + y}−${c}＝${y}（年後）`,
      ],
    };
  },

  kabusoku() {
    const n = ri(4, 15), a = ri(2, 6), diff = ri(1, 3), b = a + diff;
    let r, s;
    do { r = ri(1, 12); s = diff * n - r; } while (s <= 0);
    const total = a * n + r;
    const askPeople = Math.random() < 0.6;
    return {
      q: `子どもたちにあめを配ります。1人に${a}個ずつ配ると${r}個あまり、1人に${b}個ずつ配ると${s}個たりません。${askPeople ? "子どもは何人いますか。" : "あめは全部で何個ありますか。"}`,
      answer: askPeople ? n : total, unit: askPeople ? "人" : "個",
      hints: [
        `${a}個ずつのときと${b}個ずつのときで、必要なあめの数は全体でいくつちがう？（あまりとたりないを合わせて考えよう）`,
        `全体の差は ${r}＋${s} 個。1人あたりでは何個ちがう？`,
        `全体の差 ÷ 1人あたりの差 ＝ 人数 だよ。`,
      ],
      solution: [
        `全体の差：あまり${r}個＋たりない${s}個＝${r + s}（個）`,
        `1人あたりの差：${b}−${a}＝${diff}（個）`,
        `人数：${r + s}÷${diff}＝${n}（人）`,
        ...(askPeople ? [] : [`あめ：${a}×${n}＋${r}＝${total}（個）`]),
      ],
    };
  },
};

export function makeProblem(type) {
  const t = type === "mix" ? pick(TOKUSHU_TYPES)[0] : type;
  const p = GEN[t]();
  return { ...p, type: t, title: TOKUSHU_TYPES.find((x) => x[0] === t)[1] };
}
