import type { Thought } from "../types";

type Props = {
  thoughts: Thought[];
  thoughtId: string | null;
  playing: boolean;
  onSelectThought: (id: string) => void;
  onThink: () => void;
};

export function ThoughtControls({
  thoughts,
  thoughtId,
  playing,
  onSelectThought,
  onThink,
}: Props) {
  const active = thoughtId ?? thoughts[0]?.id ?? "";

  return (
    <div className="thought-controls">
      <h3>思考一次</h3>
      <p className="muted">Visual demo: blue pulse along a preset path (not biophysics).</p>
      <label className="field">
        <span>Path</span>
        <select
          value={active}
          onChange={(e) => onSelectThought(e.target.value)}
          disabled={playing || thoughts.length === 0}
        >
          {thoughts.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="think-btn"
        onClick={onThink}
        disabled={playing || !active}
      >
        {playing ? "传导中…" : "思考一次"}
      </button>
    </div>
  );
}
