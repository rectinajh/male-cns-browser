import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Plugin, Connect } from "vite";

export type KimiEnv = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

/** Parse KEY=VALUE lines; ignores comments/blank. */
export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function readEnvFile(filePath: string): Record<string, string> {
  try {
    if (!fs.existsSync(filePath)) return {};
    return parseEnvFile(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

/** Load Kimi credentials from process env, web/.env.local, then ~/.config. */
export function loadKimiEnv(webRoot: string): KimiEnv | null {
  const homeCfg = path.join(
    os.homedir(),
    ".config",
    "male-cns-browser",
    "kimi.env",
  );
  const localEnv = path.join(webRoot, ".env.local");
  const merged = {
    ...readEnvFile(homeCfg),
    ...readEnvFile(localEnv),
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        ([k, v]) => k.startsWith("KIMI_") && typeof v === "string" && v.length > 0,
      ),
    ),
  };

  const apiKey = merged.KIMI_API_KEY ?? "";
  const baseUrl = (merged.KIMI_BASE_URL ?? "https://api.moonshot.cn/v1").replace(
    /\/$/,
    "",
  );
  const model = merged.KIMI_MODEL ?? "moonshot-v1-8k";
  if (!apiKey) return null;
  return { apiKey, baseUrl, model };
}

export type KimiAskBody = {
  question?: string;
  neuron?: {
    id?: number | string;
    name?: string;
    type?: string;
    side?: string;
    instance?: string;
  } | null;
};

export function buildKimiMessages(body: KimiAskBody): {
  role: "system" | "user";
  content: string;
}[] {
  const n = body.neuron;
  const neuronLine = n
    ? [
        n.id != null ? `id=${n.id}` : null,
        n.name ? `name=${n.name}` : null,
        n.type ? `type=${n.type}` : null,
        n.side ? `side=${n.side}` : null,
        n.instance ? `instance=${n.instance}` : null,
      ]
        .filter(Boolean)
        .join(", ")
    : "（未选中具体神经元）";

  const question =
    (body.question ?? "").trim() ||
    "请用通俗中文解释这个神经元是什么、大致负责什么功能。";

  return [
    {
      role: "system",
      content:
        "你是果蝇雄性中枢神经系统（MaleCNS / FlyEM Janelia）科普助手。" +
        "请用简洁、准确的中文解释神经元类型、侧别与可能功能；不确定时明确说明。" +
        "不要编造突触统计；可结合已知果蝇神经生物学常识。",
    },
    {
      role: "user",
      content: `当前神经元上下文：${neuronLine}\n\n用户问题：${question}`,
    },
  ];
}

async function readJsonBody(req: Connect.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw) as unknown;
}

function sendJson(
  res: Connect.ServerResponse,
  status: number,
  payload: unknown,
): void {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(body);
}

export function kimiApiPlugin(webRoot: string): Plugin {
  return {
    name: "male-cns-kimi-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (url !== "/api/kimi") {
          next();
          return;
        }
        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "Content-Type");
          res.end();
          return;
        }
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Method not allowed" });
          return;
        }

        const env = loadKimiEnv(webRoot);
        if (!env) {
          sendJson(res, 503, {
            error:
              "未配置 Kimi：请在 ~/.config/male-cns-browser/kimi.env 或 web/.env.local 写入 KIMI_API_KEY（勿提交到 Git）。",
          });
          return;
        }

        let body: KimiAskBody;
        try {
          body = (await readJsonBody(req)) as KimiAskBody;
        } catch {
          sendJson(res, 400, { error: "请求体必须是 JSON" });
          return;
        }

        const messages = buildKimiMessages(body);
        try {
          const upstream = await fetch(`${env.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: env.model,
              messages,
              temperature: 0.3,
            }),
          });
          const data = (await upstream.json()) as {
            error?: { message?: string };
            choices?: { message?: { content?: string } }[];
          };
          if (!upstream.ok) {
            sendJson(res, upstream.status, {
              error: data.error?.message ?? `Kimi 上游错误 HTTP ${upstream.status}`,
            });
            return;
          }
          const answer =
            data.choices?.[0]?.message?.content?.trim() ??
            "（模型未返回内容）";
          sendJson(res, 200, { answer, model: env.model });
        } catch (err) {
          sendJson(res, 502, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });
    },
  };
}
