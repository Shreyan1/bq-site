// Home hero: tomorrow's industries finding their founders, anywhere in the world.
//
// The world's land is drawn as a field of ink dots, each one a person, tilted a little into
// depth across the full width of the hero. Every few seconds someone is found: a pencil
// circle is drawn around them and the industry that found them is written beside it.
// Each new find is linked to the nearest earlier one by an arc, so a small network forms
// across continents. The newest find is the only accent on screen. After a while the
// cohort fades and the next one begins.
//
// The map is WebGL (Three.js); the marks are SVG on top, so the type and pencil lines
// stay crisp. main.js loads this once the page is idle. Build with `npm run build`;
// the land dots come from `npm run land`.

import { WebGLRenderer, Scene, PerspectiveCamera, BufferGeometry, BufferAttribute, Points, ShaderMaterial, Color, Vector2, Vector3 } from 'three';
import LAND from './land.json';

const SECTORS = ['AI and cloud', 'Robotics', 'Semiconductors', 'Space tech', 'Advanced materials', 'Energy', 'Fintech', 'Proptech', 'Agri-tech'];
const SVG = 'http://www.w3.org/2000/svg';
const DRIFT = 0.035;
// Near the pointer people come into focus and gather in a little.
const LENS = 0.3;
const PULL = 0.2;
const FOV = 30;
// The map, in scene units: longitude and latitude scale, how far it tilts back, and
// the latitude it is centred on.
const SCALE = 13 / 180;
const TILT = 0.32;
const CENTRE_LAT = 10;
const HALF_WIDTH = 180 * SCALE;
const HALF_HEIGHT = 66 * SCALE;

// Seeded, so the crowd is laid out the same on every visit. Who gets found is not.
function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One person per land dot. Phones get every other dot.
function buildCrowd(every) {
  const rand = random(11);
  const count = Math.floor(LAND.length / 2 / every);
  const position = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const cos = Math.cos(TILT), sin = Math.sin(TILT);

  for (let i = 0; i < count; i++) {
    const k = i * every * 2;
    const x = (LAND[k] / 10) * SCALE;
    const y = (LAND[k + 1] / 10 - CENTRE_LAT) * SCALE;
    const z = (rand() - 0.5) * 0.18;
    // Tilt the map back, so the north recedes and the pointer reveals depth.
    position.set([x, y * cos - z * sin, -(y * sin + z * cos)], i * 3);
    seed[i] = rand();
  }
  return { position, seed, count };
}

// Must match the drift in the vertex shader, so marks sit exactly on their point.
function drift(crowd, i, t, out) {
  const p = crowd.position;
  const k = t * 0.22 + crowd.seed[i] * 40;
  return out.set(
    p[i * 3] + Math.sin(k * 0.9) * DRIFT,
    p[i * 3 + 1] + Math.sin(k * 0.7) * 0.5 * DRIFT,
    p[i * 3 + 2] + Math.cos(k * 0.8) * DRIFT,
  );
}

const crowdMaterial = (size) => new ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: {
    uTime: { value: 0 },
    uFade: { value: 0 },
    uDist: { value: 30 },
    uSize: { value: size },
    uPointer: { value: new Vector2() },
    uLens: { value: 0 },
    uAspect: { value: 1 },
    uColor: { value: new Color('#15151A') },
  },
  vertexShader: /* glsl */ `
    uniform float uTime, uFade, uSize, uLens, uAspect, uDist;
    uniform vec2 uPointer;
    attribute float aSeed;
    varying float vAlpha;

    void main() {
      float k = uTime * 0.22 + aSeed * 40.0;
      vec3 p = position + vec3(sin(k * 0.9), sin(k * 0.7) * 0.5, cos(k * 0.8)) * ${DRIFT.toFixed(2)};
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;

      // Where you look, people come into focus and turn towards you.
      vec2 ndc = gl_Position.xy / gl_Position.w;
      vec2 d = (ndc - uPointer) * vec2(uAspect, 1.0);
      float focus = (1.0 - smoothstep(0.0, ${LENS.toFixed(2)}, length(d))) * uLens;
      gl_Position.xy -= (ndc - uPointer) * focus * focus * ${PULL.toFixed(2)} * gl_Position.w;

      // Nearer people are darker, and each one glimmers slowly, like a city at night.
      float depth = -mv.z;
      float glimmer = 0.82 + 0.18 * sin(uTime * 0.7 + aSeed * 31.0);
      gl_PointSize = uSize * (1.0 + focus * 0.8) / depth;
      vAlpha = uFade * (mix(0.2, 0.6, smoothstep(uDist + 5.0, uDist - 5.0, depth)) * glimmer + focus * 0.3);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    varying float vAlpha;

    void main() {
      float a = smoothstep(0.5, 0.3, length(gl_PointCoord - 0.5)) * vAlpha;
      if (a < 0.01) discard;
      gl_FragColor = vec4(uColor, a);
    }
  `,
});

// A quick hand-drawn circle: it overshoots its start, wobbles and leans a little.
function pencilCircle(r) {
  const turns = 1.1 + Math.random() * 0.12;
  const start = Math.random() * Math.PI * 2;
  const squash = 0.82 + Math.random() * 0.12;
  const lean = (Math.random() - 0.5) * 0.9;
  const phase = Math.random() * 6;
  let d = '';
  for (let k = 0; k <= 56; k++) {
    const f = k / 56;
    const a = start + f * turns * Math.PI * 2;
    const rr = r * (1 + 0.06 * Math.sin(a * 2 + phase) + f * 0.12);
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr * squash;
    d += `${k ? 'L' : 'M'}${(x * Math.cos(lean) - y * Math.sin(lean)).toFixed(1)} ${(x * Math.sin(lean) + y * Math.cos(lean)).toFixed(1)}`;
  }
  return d;
}

const el = (name, attrs = {}, parent) => {
  const node = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  parent?.append(node);
  return node;
};

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export default function mount(host, { still = false } = {}) {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const pixelRatio = Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2);

  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);
  host.prepend(renderer.domElement);
  const svg = el('svg', { class: 'finds', 'aria-hidden': 'true' }, host);
  const hero = host.parentElement;

  const crowd = buildCrowd(coarse ? 2 : 1);
  const count = crowd.count;
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(crowd.position, 3));
  geometry.setAttribute('aSeed', new BufferAttribute(crowd.seed, 1));
  const points = new Points(geometry, crowdMaterial(72 * pixelRatio));
  const u = points.material.uniforms;

  const scene = new Scene();
  scene.add(points);
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);

  // Layout, recomputed on resize.
  let width = 0, height = 0, wide = true, distance = 30, region, ring, perCohort, spacing;
  const resize = () => {
    width = host.clientWidth;
    height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    camera.aspect = u.uAspect.value = width / height;
    wide = width >= 960;
    camera.updateProjectionMatrix();
    // The map runs the full width of the hero, faint behind the text on wide screens. On
    // narrow screens it is its own block below the text, cropped a little at the edges.
    const tan = Math.tan((FOV / 2) * (Math.PI / 180));
    const fit = wide ? 1.02 : 0.8;
    distance = Math.max((HALF_WIDTH * fit) / (tan * camera.aspect), HALF_HEIGHT / (tan * 0.9));
    u.uDist.value = distance;
    // Finds happen where the map is clear of the text.
    region = wide
      ? { x: width * 0.56, y: height * 0.14, w: width * 0.38, h: height * 0.7 }
      : { x: width * 0.06, y: height * 0.1, w: width * 0.88, h: height * 0.8 };
    ring = wide ? 17 : 14;
    perCohort = wide ? 6 : 5;
    spacing = wide ? 120 : 84;
  };

  const v = new Vector3();
  const toScreen = (i, t) => {
    drift(crowd, i, t, v);
    const depth = camera.position.z - v.z;
    v.project(camera);
    // The same pull as the shader, so marks stay on their person.
    const lens = u.uLens.value;
    if (lens > 0.001) {
      const dx = v.x - u.uPointer.value.x, dy = v.y - u.uPointer.value.y;
      const focus = (1 - smoothstep(0, LENS, Math.hypot(dx * camera.aspect, dy))) * lens;
      v.x -= dx * focus * focus * PULL;
      v.y -= dy * focus * focus * PULL;
    }
    return { x: (v.x + 1) / 2 * width, y: (1 - v.y) / 2 * height, depth };
  };

  // Cohorts of finds.
  let cohort = null, sector = 0, clock = 0;

  const newCohort = (at) => {
    const group = el('g', { class: 'cohort' }, svg);
    cohort = { group, links: el('g', {}, group), marks: el('g', {}, group), finds: [], next: at, clearAt: Infinity };
  };

  const labelBox = (f) => ({ x: f.right ? f.x + ring : f.x - ring - f.labelWidth, y: f.y - 10, w: f.labelWidth, h: 20 });
  const dotBox = (x, y) => ({ x: x - ring - 4, y: y - ring - 4, w: (ring + 4) * 2, h: (ring + 4) * 2 });

  // A person to be found, labelled with the next industry.
  const candidate = (p, i) => {
    const name = SECTORS[sector % SECTORS.length];
    const labelWidth = 44 + name.length * 7.4;
    return { ...p, i, name, labelWidth, right: p.x + ring + labelWidth < width - 12 };
  };

  const find = (t) => {
    const used = new Set(cohort.finds.map((f) => f.i));
    for (let tries = 0; tries < 400; tries++) {
      const i = Math.floor(Math.random() * count);
      if (used.has(i)) continue;
      const p = toScreen(i, t);
      if (p.x < region.x || p.x > region.x + region.w || p.y < region.y || p.y > region.y + region.h) continue;
      const c = candidate(p, i);
      const mine = [dotBox(p.x, p.y), labelBox(c)];
      const clash = cohort.finds.some((f) => Math.hypot(f.x - p.x, f.y - p.y) < spacing
        || mine.some((box) => overlaps(box, dotBox(f.x, f.y)) || overlaps(box, labelBox(f))));
      if (!clash) return c;
    }
    return null;
  };

  // The person nearest a point on screen, for the visitor's own finds.
  const nearest = (x, y, t) => {
    const used = new Set(cohort.finds.map((f) => f.i));
    let best = null, bestDistance = wide ? 44 : 40;
    for (let i = 0; i < count; i++) {
      if (used.has(i)) continue;
      const p = toScreen(i, t);
      const distance = Math.hypot(p.x - x, p.y - y);
      if (distance < bestDistance) { best = { p, i }; bestDistance = distance; }
    }
    return best;
  };

  const findAt = (x, y) => cohort?.finds.find((f) => Math.hypot(f.x - x, f.y - y) < ring + 6);

  const place = (f, t) => {
    const p = toScreen(f.i, t);
    f.x = p.x;
    f.y = p.y;
    f.mark.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    if (f.link) {
      // An arc that bows upwards, like a route between two places.
      const dx = p.x - f.parent.x, dy = p.y - f.parent.y;
      const len = Math.hypot(dx, dy) || 1;
      const gap = ring + 4;
      const ax = f.parent.x + dx / len * gap, ay = f.parent.y + dy / len * gap;
      const bx = p.x - dx / len * gap, by = p.y - dy / len * gap;
      const cx = (ax + bx) / 2, cy = Math.min(ay, by) - len * 0.22;
      f.link.setAttribute('d', `M${ax.toFixed(1)} ${ay.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`);
    }
  };

  const addFind = (t, chosen) => {
    const f = chosen || find(t);
    if (!f) return;
    sector++;
    const n = cohort.finds.length + 1;

    // Link to the nearest earlier find, so the network branches instead of making a chain.
    let parent = null;
    for (const g of cohort.finds) {
      if (!parent || Math.hypot(g.x - f.x, g.y - f.y) < Math.hypot(parent.x - f.x, parent.y - f.y)) parent = g;
    }
    f.parent = parent;
    if (parent) f.link = el('path', { class: 'find-link', pathLength: 1 }, cohort.links);

    f.mark = el('g', { class: 'find' }, cohort.marks);
    el('circle', { class: 'find-dot', r: wide ? 3.2 : 2.8 }, f.mark);
    el('path', { class: 'find-ring', d: pencilCircle(ring), pathLength: 1 }, f.mark);
    const label = el('g', { class: 'find-label', transform: `translate(${f.right ? ring + 8 : -ring - 8} 0)` }, f.mark);
    const text = el('text', { 'text-anchor': f.right ? 'start' : 'end', y: 4 }, label);
    el('tspan', { class: 'find-n' }, text).textContent = String(n).padStart(2, '0');
    el('tspan', { dx: 7 }, text).textContent = f.name.toUpperCase();

    cohort.finds.forEach((g) => g.mark.classList.remove('is-current'));
    f.mark.classList.add('is-current');
    cohort.finds.push(f);
    place(f, t);

    // Two frames later, so the transitions run from their start.
    const show = () => { f.mark.classList.add('is-in'); f.link?.classList.add('is-in'); };
    if (still) show();
    else requestAnimationFrame(() => requestAnimationFrame(show));
  };

  const updateCohort = (t) => {
    if (!cohort) newCohort(1.8);
    if (t >= cohort.clearAt) {
      // The cohort fades; the next begins once it has gone.
      const old = cohort.group;
      old.classList.add('is-out');
      setTimeout(() => old.remove(), 1600);
      newCohort(t + 2.4);
    }
    if (cohort.finds.length < perCohort && t >= cohort.next) {
      addFind(t);
      cohort.next = t + 2.3;
      if (cohort.finds.length >= perCohort) cohort.clearAt = t + 8;
    }
    // Drift moves the people, and their marks move with them.
    cohort.finds.forEach((f) => place(f, t));
  };

  // The pointer. The crowd focuses and gathers towards it, the camera moves with it so
  // near people shift more than far ones, and a faint circle offers the nearest person.
  const pointer = new Vector2();
  const at = { x: 0, y: 0 };
  let pointerIn = false, moved = false, lookX = 0, lookY = 0, offer = null, hovered = null;
  const ghost = el('path', { class: 'find-ghost', d: pencilCircle(wide ? 17 : 14) }, svg);
  // On wide screens the left of the hero is text, so only the crowd side responds.
  const inCrowd = (x, y) => x >= 0 && y >= 0 && x <= width && y <= height && (!wide || x > width * 0.46);

  if (!still && !coarse) {
    addEventListener('pointermove', (e) => {
      const box = host.getBoundingClientRect();
      at.x = e.clientX - box.left;
      at.y = e.clientY - box.top;
      pointerIn = at.y >= 0 && at.y <= box.height;
      pointer.set((at.x / box.width) * 2 - 1, -(at.y / box.height) * 2 + 1);
      moved = true;
    }, { passive: true });
    document.addEventListener('pointerout', (e) => { if (!e.relatedTarget) pointerIn = false; });
  }

  const hover = (t) => {
    const over = pointerIn && inCrowd(at.x, at.y);
    const hit = over ? findAt(at.x, at.y) : null;
    if (hit !== hovered) {
      hovered?.mark.classList.remove('is-hover');
      cohort.finds.forEach((f) => f.link?.classList.remove('is-hover'));
      hovered = hit;
      if (hit) {
        hit.mark.classList.add('is-hover');
        cohort.finds.forEach((f) => { if (f === hit || f.parent === hit) f.link?.classList.add('is-hover'); });
      }
    }
    if (moved) offer = over && !hit ? nearest(at.x, at.y, t) : null;
    moved = false;
    if (offer) {
      const p = toScreen(offer.i, t);
      offer.p = p;
      ghost.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    }
    ghost.classList.toggle('is-on', !!offer);
    hero.style.cursor = offer || hit ? 'pointer' : '';
  };

  // Click or tap in the crowd to find someone yourself.
  if (!still) {
    hero.addEventListener('click', (e) => {
      if (e.target.closest('a, button') || String(getSelection())) return;
      const box = host.getBoundingClientRect();
      const x = e.clientX - box.left, y = e.clientY - box.top;
      if (!inCrowd(x, y) || findAt(x, y) || cohort.finds.length >= perCohort + 4) return;
      const near = offer || nearest(x, y, clock);
      if (!near) return;
      addFind(clock, candidate(toScreen(near.i, clock), near.i));
      offer = null;
      cohort.next = Math.max(cohort.next, clock + 2.3);
      if (cohort.finds.length >= perCohort) cohort.clearAt = clock + 9;
      host.classList.add('was-used');
    });
  }

  // Scrolling away moves the camera in towards the map.
  const aim = (scrolled) => {
    camera.position.set(lookX, lookY, distance * lerp(1, 0.8, ease(scrolled)));
    camera.lookAt(lookX * 0.3, lookY * 0.3, 0);
    camera.updateMatrixWorld();
  };

  let last = 0;
  const frame = (now) => {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    clock += dt;

    u.uTime.value = clock;
    u.uFade.value = ease(clamp01(clock / 1.6));
    u.uLens.value = lerp(u.uLens.value, pointerIn ? 1 : 0, 0.06);
    u.uPointer.value.copy(pointer);

    lookX = lerp(lookX, pointerIn ? pointer.x * distance * 0.05 : 0, 0.035);
    lookY = lerp(lookY, pointerIn ? pointer.y * distance * 0.04 : 0, 0.035);
    const box = host.getBoundingClientRect();
    aim(clamp01(-box.top / box.height));

    updateCohort(clock);
    if (!coarse) hover(clock);
    renderer.render(scene, camera);
  };

  // Reduced motion: one finished cohort, nothing moving.
  const drawStill = () => {
    svg.replaceChildren();
    newCohort(0);
    u.uFade.value = 1;
    aim(0);
    for (let k = 0; k < perCohort; k++) addFind(0);
    renderer.render(scene, camera);
  };

  resize();
  addEventListener('resize', () => { resize(); if (still) drawStill(); });

  if (still) {
    drawStill();
  } else {
    // Only animate while the hero is on screen and the tab is visible.
    let onScreen = true;
    const run = () => {
      last = 0;
      renderer.setAnimationLoop(onScreen && !document.hidden ? frame : null);
    };
    new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; run(); }).observe(host);
    document.addEventListener('visibilitychange', run);
    run();
  }

  if (!still) {
    const hint = document.createElement('p');
    hint.className = 'hero-hint';
    hint.textContent = coarse ? 'Tap the map to find someone' : 'Click the map to find someone';
    host.append(hint);
  }

  requestAnimationFrame(() => host.classList.add('is-ready'));
}
