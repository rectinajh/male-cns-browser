import { useState } from "react";
import type { Neuron } from "../types";

type Props = {
  neuron: Neuron | null;
};

type AskResponse = {
  answer?: string;
  error?: string;
  model?: string;
};

export function KimiAsk({ neuron }: Props) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask() {
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch("/api/kimi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question:
            question.trim() ||
            "请用通俗中文解释这个神经元是什么、类型含义和大致功能。",
          neuron: neuron
            ? {
                id: neuron.id,
                name: neuron.name,
                type: neuron.type,
                side: neuron.side,
                instance: neuron.name,
              }
            : null,
        }),
      });
      const data = (await res.json()) as AskResponse;
      if (!res.ok) {
        setError(data.error ?? `请求失败 HTTP ${res.status}`);
        return;
      }
      setAnswer(data.answer ?? "（无回复）");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="kimi-ask">
      <h3>Kimi 查询</h3>
      <p className="muted">
        {neuron
          ? `针对已选：${neuron.name}（${neuron.type} · ${neuron.side} · #${neuron.id}）`
          : "可先点选神经元，或直接提问通用概念。"}
      </p>
      <textarea
        className="kimi-input"
        rows={3}
        placeholder="例如：这个类型在果蝇视觉通路里干什么？左右侧有什么区别？"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        disabled={loading}
      />
      <button
        type="button"
        className="kimi-btn"
        onClick={() => void ask()}
        disabled={loading}
      >
        {loading ? "查询中…" : "问 Kimi"}
      </button>
      {error ? <p className="kimi-error">{error}</p> : null}
      {answer ? (
        <div className="kimi-answer">
          <h4>解释</h4>
          <p>{answer}</p>
        </div>
      ) : null}
    </div>
  );
}
