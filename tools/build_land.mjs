// Samples the world's land onto a grid of dots for the home hero (src/land.json).
// Run with `npm run land`; only needed if the grid or the source map changes.
// Land shapes: Natural Earth 1:110m, via the world-atlas package (public domain).

import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';

const STEP = 2; // degrees between dots
const topo = JSON.parse(readFileSync(new URL('../node_modules/world-atlas/land-110m.json', import.meta.url)));
const land = feature(topo, topo.objects.land);

const polygons = land.features.flatMap((f) =>
  f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates);

// Even-odd ray casting on longitude and latitude. Fine at this scale.
const inRing = (x, y, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const onLand = (x, y) => polygons.some((rings) => rings.reduce((inside, ring) => inside !== inRing(x, y, ring), false));

const dots = [];
// Antarctica and the far north are left out: they stretch badly on a flat map.
for (let lat = 76; lat >= -56; lat -= STEP) {
  // Every other row is shifted half a step, so the dots sit on a staggered grid.
  const shift = ((76 - lat) / STEP) % 2 ? STEP / 2 : 0;
  for (let lon = -180 + shift; lon < 180; lon += STEP) {
    if (onLand(lon, lat)) dots.push(Math.round(lon * 10), Math.round(lat * 10));
  }
}

writeFileSync(new URL('../src/land.json', import.meta.url), JSON.stringify(dots));
console.log(`${dots.length / 2} land dots`);
