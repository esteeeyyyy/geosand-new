import { DEPTH_SUITABILITY } from '../utils/depthSuitability';

const legendItems = [
  DEPTH_SUITABILITY.good,
  DEPTH_SUITABILITY.fair,
  DEPTH_SUITABILITY.unsuitable,
];

export default function DepthHeatmapLegend() {
  return (
    <section className="depth-heatmap-legend" aria-label="Topographic elevation suitability heatmap legend">
      <div className="depth-heatmap-legend__heading">
        <strong>Depth suitability</strong>
        <span>Relative DEM elevation within quarry</span>
      </div>
      <div className="depth-heatmap-legend__items">
        {legendItems.map((item) => (
          <div className="depth-heatmap-legend__item" key={item.key}>
            <span className="depth-heatmap-legend__swatch" style={{ background: item.color }} />
            <span>
              <strong>{item.label}</strong>
              <small>{item.range}</small>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
