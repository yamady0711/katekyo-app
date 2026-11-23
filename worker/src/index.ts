// 家庭教師アプリの中継 Worker
// - APIキーはここ（Cloudflare のシークレット）にだけ置く。フロントには渡さない
// - システムプロンプトは prompts/*.md をデプロイ時に同梱する
import Anthropic from "@anthropic-ai/sdk";
import commonPrompt from "../../prompts/common.md";
import kokugoPrompt from "../../prompts/kokugo-kijutsu.md";
import tentaiPrompt from "../../prompts/rika-tentai.md";
import summaryPrompt from "../../prompts/summary.md";

interface Env {
  ANTHROPIC_API_KEY: string;
  APP_PASSCODE: string;
  ALLOWED_ORIGINS: string;
  EFFORT?: string;
}

const MODEL = "claude-opus-5-5";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

const MODES: Record<string, { label: string; prompt: string }> = {
  "kokugo-kijutsu": { label: "国語・記述", prompt: kokugoPrompt },
  "rika-tentai": { label: "理科・天体", prompt: tentaiPrompt },
};

const LIMITS = {
  bodyBytes: 20 * 1024 * 1024,
  messages: 80,
  images: 12,
  textChars: 4000,
};

// ---------- 入力チェック ----------

type InTextBlock = { type: "text"; text: string };
type InImageBlock = {
  type: "image";
  source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp"; data: string };
};
type InMessage = { role: "user" | "assistant"; content: string | Array<InTextBlock | InImageBlock> };

class BadRequest extends Error {}

function validateMessages(raw: unknown, requireLastUser: boolean): InMessage[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new BadRequest("messages がありません");
  if (raw.length > LIMITS.messages) throw new BadRequest("会話が長すぎます。新しく始めてください");
  let images = 0;
  const out: InMessage[] = raw.map((m: any, i: number) => {
    const role = m?.role;
    if (role !== "user" && role !== "assistant") throw new BadRequest(`role が不正です (${i})`);
    if (i === 0 && role !== "user") throw new BadRequest("最初は user のメッセージにしてください");
    if (i > 0 && raw[i - 1].role === role) throw new BadRequest("user と assistant は交互にしてください");
    if (typeof m.content === "string") {
      if (m.content.length > LIMITS.textChars) throw new BadRequest("文が長すぎます");
      return { role, content: m.content };
    }
    if (!Array.isArray(m.content) || m.content.length === 0) throw new BadRequest(`content が不正です (${i})`);
    const blocks = m.content.map((b: any) => {
      if (b?.type === "text" && typeof b.text === "string") {
        if (b.text.length > LIMITS.textChars) throw new BadRequest("文が長すぎます");
        return { type: "text", text: b.text } as InTextBlock;
      }
      if (
        role === "user" &&
        b?.type === "image" &&
        b.source?.type === "base64" &&
        ["image/jpeg", "image/png", "image/webp"].includes(b.source.media_type) &&
        typeof b.source.data === "string"
      ) {
        images++;
        return { type: "image", source: { type: "base64", media_type: b.source.media_type, data: b.source.data } } as InImageBlock;
      }
      throw new BadRequest(`対応していない内容です (${i})`);
    });
    return { role, content: blocks };
  });
  if (images > LIMITS.images) throw new BadRequest("写真が多すぎます");
  if (requireLastUser && out[out.length - 1].role !== "user") throw new BadRequest("最後は user のメッセージにしてください");
  return out;
}

// ---------- CORS・認証 ----------

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-App-Pass",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin && allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });
}

function friendlyError(err: unknown): { status: number; message: string } {
  if (err instanceof BadRequest) return { status: 400, message: err.message };
  if (err instanceof Anthropic.RateLimitError) return { status: 429, message: "混み合っています。少し待ってからもう一度送ってね" };
  if (err instanceof Anthropic.AuthenticationError) return { status: 500, message: "サーバーの設定エラーです（APIキー）。お父さんに伝えてね" };
  if (err instanceof Anthropic.BadRequestError) return { status: 400, message: "送った内容を処理できませんでした。写真を撮り直すか、新しく始めてね" };
  if (err instanceof Anthropic.APIError) return { status: 502, message: "AIにつながりませんでした。もう一度送ってね" };
  return { status: 500, message: "エラーが起きました。もう一度送ってね" };
}

function effortOf(env: Env): "low" | "medium" | "high" {
  return env.EFFORT === "medium" || env.EFFORT === "high" ? env.EFFORT : "low";
}

// ---------- /api/chat（ストリーミング） ----------

function handleChat(mode: string, messages: InMessage[], env: Env, cors: Record<string, string>): Response {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const system = `${commonPrompt}\n\n${MODES[mode].prompt}`;
  const enc = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        const stream = client.beta.messages.stream({
          model: MODEL,
          max_tokens: 8000,
          betas: [FALLBACK_BETA],
          fallbacks: "default",
          output_config: { effort: effortOf(env) },
          // システムプロンプトと、写真を含む会話の先頭をキャッシュして2ターン目以降を安くする
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          cache_control: { type: "ephemeral" },
          messages,
        });
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            send({ t: "text", v: event.delta.text });
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          send({ t: "error", v: "この内容にはこたえられませんでした。言い方を変えるか、新しく始めてね" });
        } else {
          send({ t: "done", stop: final.stop_reason, usage: final.usage });
        }
      } catch (err) {
        console.error(err);
        send({ t: "error", v: friendlyError(err).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { ...cors, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
  });
}

// ---------- /api/summary（学習記録） ----------

const SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["unit", "problem", "stumbles", "achieved", "hintLevel", "finalState", "parentAttention", "parentNote", "aiConcerns"],
  properties: {
    unit: { type: "string", description: "単元・分野（例：物語文の心情記述、月の満ち欠け）" },
    problem: { type: "string", description: "どの問題か（塾テキストの回・問題番号がわかれば含める）" },
    stumbles: { type: "array", items: { type: "string" }, description: "つまずいた点（具体的に）" },
    achieved: { type: "string", description: "自力でできたこと" },
    hintLevel: { type: "integer", description: "使った一番強いヒントの段階（0=なし〜4=型を見せた）" },
    finalState: { type: "string", enum: ["自力で完成", "ヒントで完成", "未完成"] },
    parentAttention: { type: "string", enum: ["high", "medium", "low"] },
    parentNote: { type: "string", description: "お父さんへの一言（何を見てほしいか）" },
    aiConcerns: { type: "string", description: "AIの説明に不安な所・読み取れなかった所。なければ空文字" },
  },
} as const;

function toTranscript(messages: InMessage[]): string {
  const lines = messages.map((m) => {
    const who = m.role === "user" ? "子ども" : "先生(AI)";
    const text =
      typeof m.content === "string"
        ? m.content
        : m.content.map((b) => (b.type === "text" ? b.text : "［写真］")).join("\n");
    return `${who}: ${text}`;
  });
  return lines.join("\n\n");
}

async function handleSummary(mode: string, messages: InMessage[], env: Env, cors: Record<string, string>): Promise<Response> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SUMMARY_SCHEMA } },
    system: summaryPrompt,
    messages: [
      {
        role: "user",
        content: `科目：${MODES[mode].label}\n\n--- 会話 ---\n${toTranscript(messages)}\n--- ここまで ---\n\nこの会話の学習記録を作ってください。`,
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new Error("summary refused");
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return json({ record: JSON.parse(text) }, 200, cors);
}

// ---------- ルーティング ----------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin, env);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (!cors["Access-Control-Allow-Origin"]) return json({ error: "このオリジンからは使えません" }, 403, cors);
    if (request.method !== "POST") return json({ error: "POST のみです" }, 405, cors);
    if (url.pathname !== "/api/chat" && url.pathname !== "/api/summary") return json({ error: "not found" }, 404, cors);

    if (!env.APP_PASSCODE || !timingSafeEqual(request.headers.get("X-App-Pass") ?? "", env.APP_PASSCODE)) {
      return json({ error: "合言葉がちがいます" }, 401, cors);
    }
    if (Number(request.headers.get("Content-Length") ?? 0) > LIMITS.bodyBytes) {
      return json({ error: "写真が大きすぎます" }, 413, cors);
    }

    try {
      const body: any = await request.json();
      const mode = String(body?.mode ?? "");
      if (!MODES[mode]) throw new BadRequest("モードが不正です");
      const isChat = url.pathname === "/api/chat";
      const messages = validateMessages(body?.messages, isChat);
      if (isChat) return handleChat(mode, messages, env, cors);
      return await handleSummary(mode, messages, env, cors);
    } catch (err) {
      console.error(err);
      const { status, message } = friendlyError(err);
      return json({ error: message }, status, cors);
    }
  },
};
