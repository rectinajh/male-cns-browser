const REFERENCES = [
  {
    src: "/reference/dimorphic-brain-only.jpg",
    caption: "二型脑参考图",
    alt: "雄性 CNS 二型脑参考渲染",
  },
  {
    src: "/reference/mcns-median-size-per-type-40-0626-3840x2160.jpg",
    caption: "各类型中位尺寸",
    alt: "雄性 CNS 各类型中位尺寸参考渲染",
  },
] as const;

export function ReferencePanel() {
  return (
    <aside className="reference-panel" aria-label="参考渲染图">
      {REFERENCES.map((item) => (
        <figure key={item.src} className="reference-figure">
          <div className="reference-media">
            <img
              className="reference-image"
              src={item.src}
              alt={item.alt}
              loading="lazy"
              decoding="async"
            />
          </div>
          <figcaption className="reference-caption">{item.caption}</figcaption>
        </figure>
      ))}
    </aside>
  );
}
