// Samples the world's land onto a grid of dots for the home hero (src/land.json).
// Run with `npm run land`; only needed if the grid or the source map changes.
// Land shapes: Natural Earth 1:50m, via the world-atlas package (public domain).
//
// The grid is even on the projected map (Miller cylindrical, which keeps the shapes
// people expect without Mercator's huge poles), so the dots sit in clean rows on screen.
// The land test is spherical (d3-geo), so land that crosses the 180° meridian is right.
//
// The output is run-length encoded by row, so a fine grid stays small:
// { step, left, top, bottom, rows: [[row, firstCol, lastCol, firstCol, lastCol, ...], ...] }
// A dot sits at x = left + col * step, y = top - row * step, plus half a step on odd rows,
// in Miller units (x is longitude in radians).

import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';
import { geoContains } from 'd3-geo';

const STEP = (1.25 * Math.PI) / 180;
const NORTH = 84; // the tip of Greenland
const SOUTH = -56; // Cape Horn. Antarctica is left out.

const miller = (lat) => 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * lat));
const inverse = (y) => (2.5 * Math.atan(Math.exp(0.8 * y)) - 0.625 * Math.PI) * (180 / Math.PI);

const topo = JSON.parse(readFileSync(new URL('../node_modules/world-atlas/land-50m.json', import.meta.url)));
const land = feature(topo, topo.objects.land);

const left = -Math.PI;
const top = miller((NORTH * Math.PI) / 180);
const bottom = miller((SOUTH * Math.PI) / 180);

const rows = [];
let dots = 0;
for (let row = 0; top - row * STEP >= bottom; row++) {
  const lat = inverse(top - row * STEP);
  // Every other row is shifted half a step, so the dots sit on a staggered grid.
  const shift = row % 2 ? STEP / 2 : 0;
  const runs = [];
  let start = -1;
  for (let col = 0; ; col++) {
    const lon = ((left + shift + col * STEP) * 180) / Math.PI;
    const on = lon < 180 && geoContains(land, [lon, lat]);
    if (on && start < 0) start = col;
    if (!on && start >= 0) { runs.push(start, col - 1); dots += col - start; start = -1; }
    if (lon >= 180) break;
  }
  if (runs.length) rows.push([row, ...runs]);
}

const round = (x) => Math.round(x * 1e5) / 1e5;
writeFileSync(new URL('../src/land.json', import.meta.url),
  JSON.stringify({ step: round(STEP), left: round(left), top: round(top), bottom: round(bottom), rows }));
console.log(`${dots} land dots in ${rows.length} rows`);
