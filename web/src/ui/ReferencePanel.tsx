const REFERENCES = [
  {
    src: "/reference/dimorphic-brain-only.png",
    caption: "Dimorphic brain",
    alt: "Male CNS dimorphic brain reference render",
  },
  {
    src: "/reference/mcns-median-size-per-type-40-0626-3840x2160-white.png",
    caption: "Median size per type",
    alt: "Male CNS median size per type reference render",
  },
] as const;

export function ReferencePanel() {
  return (
    <aside className="reference-panel" aria-label="Reference renders">
      {REFERENCES.map((item) => (
        <figure key={item.src} className="reference-figure">
          <img
            className="reference-image"
            src={item.src}
            alt={item.alt}
            loading="lazy"
            decoding="async"
          />
          <figcaption className="reference-caption">{item.caption}</figcaption>
        </figure>
      ))}
    </aside>
  );
}
