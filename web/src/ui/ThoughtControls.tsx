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
        Each click picks a fresh random walk on connectome edges. Blue
        charge packets (#3BA7FF) race along real MaleCNS skeletons; somas flash
        on arrival and leave a short afterglow (~4–8s demo, not biophysics).
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
