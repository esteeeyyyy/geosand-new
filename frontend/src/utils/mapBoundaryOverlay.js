const SVG_NS = 'http://www.w3.org/2000/svg';

export function createMapBoundaryOverlay(map, coordinates, color = '#0F766E') {
  if (!map || !Array.isArray(coordinates) || coordinates.length < 3) {
    return () => {};
  }

  const container = map.getContainer();
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = `
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    pointer-events: none;
    z-index: 2;
  `;

  const casing = document.createElementNS(SVG_NS, 'polyline');
  casing.setAttribute('fill', 'none');
  casing.setAttribute('stroke', '#FFFFFF');
  casing.setAttribute('stroke-width', '7');
  casing.setAttribute('stroke-opacity', '0.95');
  casing.setAttribute('stroke-linecap', 'round');
  casing.setAttribute('stroke-linejoin', 'round');

  const line = document.createElementNS(SVG_NS, 'polyline');
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', '3.5');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('stroke-linejoin', 'round');

  svg.append(casing, line);
  container.appendChild(svg);

  const update = () => {
    if (!svg.isConnected) return;
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const projectedPoints = coordinates
      .map(([longitude, latitude]) => map.project([longitude, latitude]))
      .map((point) => `${point.x},${point.y}`)
      .join(' ');
    casing.setAttribute('points', projectedPoints);
    line.setAttribute('points', projectedPoints);
  };

  map.on('render', update);
  map.on('resize', update);
  update();

  return () => {
    map.off('render', update);
    map.off('resize', update);
    svg.remove();
  };
}
