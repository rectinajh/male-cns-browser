/**
 * Vercel serverless proxy for Moonshot/Kimi.
 * Set KIMI_API_KEY (and optional KIMI_BASE_URL / KIMI_MODEL) in project env.
 * Never commit secrets.
 */

function buildKimiMessages(body) {
  const n = body?.neuron;
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
    (body?.question ?? "").trim() ||
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

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.KIMI_API_KEY ?? "";
  const baseUrl = (process.env.KIMI_BASE_URL ?? "https://api.moonshot.cn/v1").replace(
    /\/$/,
    "",
  );
  const model = process.env.KIMI_MODEL ?? "kimi-k3";

  if (!apiKey) {
    return res.status(503).json({
      error:
        "未配置 Kimi：请在 Vercel 项目 Environment Variables 中设置 KIMI_API_KEY（以及可选的 KIMI_BASE_URL / KIMI_MODEL）。",
    });
  }

  const body = req.body ?? {};
  const messages = buildKimiMessages(body);

  try {
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 1,
      }),
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: data.error?.message ?? `Kimi 上游错误 HTTP ${upstream.status}`,
      });
    }
    const answer =
      data.choices?.[0]?.message?.content?.trim() ?? "（模型未返回内容）";
    return res.status(200).json({ answer, model });
  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
