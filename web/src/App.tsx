import { useEffect, useMemo, useState } from "react";
import type { SubsetFile } from "./types";
import { LocalJsonSource } from "./data/LocalJsonSource";
import { NeuronScene } from "./scene/NeuronScene";
import { Sidebar } from "./ui/Sidebar";
import { useBrowserStore } from "./state/useBrowserStore";
import "./styles.css";

export default function App() {
  const source = useMemo(() => new LocalJsonSource("/data/subset.json"), []);
  const [data, setData] = useState<SubsetFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const setThoughtId = useBrowserStore((s) => s.setThoughtId);

  useEffect(() => {
    let cancelled = false;
    source
      .load()
      .then((subset) => {
        if (cancelled) return;
        setData(subset);
        if (subset.thoughts[0]) setThoughtId(subset.thoughts[0].id);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [source, setThoughtId]);

  if (error) {
    return (
      <div className="error">
        <div>
          <h1>Failed to load subset</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="loading">
        <p>Loading Male CNS subset…</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar data={data} source={source} />
      <div className="viewport">
        <NeuronScene data={data} source={source} />
      </div>
    </div>
  );
}
