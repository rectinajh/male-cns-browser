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
        Each click picks a fresh random walk on neuPrint edges, then flashes a blue
        #3BA7FF current along the skeletons (visual demo, not biophysics).
      </p>
      {lastChain && lastChain.length >= 2 ? (
        <p className="muted path-meta">
          Last path · {lastChain.length} neurons · {lastChain.join(" → ")}
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
