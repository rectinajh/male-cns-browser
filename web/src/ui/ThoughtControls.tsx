type Props = {
  playing: boolean;
  /** Neuron ids of the last / current random path (for display). */
  lastChain: number[] | null;
  onThink: () => void;
};

export function ThoughtControls({ playing, lastChain, onThink }: Props) {
  return (
    <div className="thought-controls">
      <h3>思考一次</h3>
      <p className="muted">
        每次点击在连接组边上随机走一条新路径。蓝色闪电（#3BA7FF）贴着真实
        MaleCNS 骨架闪烁传导；胞体到达时会闪一下并留下短余辉（约 4–8
        秒演示，非生物物理）。
      </p>
      {lastChain && lastChain.length >= 2 ? (
        <p className="muted path-meta">
          上次路径 · {lastChain.length} 个神经元 · {lastChain.join(" → ")}
        </p>
      ) : null}
      <button
        type="button"
        className="think-btn"
        onClick={onThink}
        disabled={playing}
      >
        {playing ? "传导中…" : "思考一次"}
      </button>
    </div>
  );
}
