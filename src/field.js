// Home hero: tomorrow's industries finding their founders.
//
// A crowd of people (ink points in loose groups, the communities, spread through depth)
// mills about on the right of the hero. Every few seconds one of them is found: a pencil
// circle is drawn around them and the industry that found them is written beside it.
// Each new find is linked to the nearest earlier one, so a small network forms inside a
// large crowd. The newest find is the only accent on screen. After a while the cohort
// fades and the next one begins.
//
// The crowd is WebGL (Three.js); the marks are SVG on top, so the type and pencil lines
// stay crisp. main.js loads this once the page is idle. Build with `npm run build`.

import { WebGLRenderer, Scene, PerspectiveCamera, BufferGeometry, BufferAttribute, Points, ShaderMaterial, Color, Vector2, Vector3 } from 'three';

const SECTORS = ['AI and cloud', 'Robotics', 'Semiconductors', 'Space tech', 'Advanced materials', 'Energy', 'Fintech', 'Proptech', 'Agri-tech'];
const SVG = 'http://www.w3.org/2000/svg';
const DRIFT = 0.16;
// Near the pointer the crowd comes into focus and gathers in a little.
const LENS = 0.34;
const PULL = 0.28;
const FOV = 30;

// Seeded, so the crowd is laid out the same on every visit. Who gets found is not.
function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildCrowd(count) {
  const rand = random(11);
  const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand());
  // People stand in loose groups with others scattered between them.
  const groups = Array.from({ length: 16 }, () => [(rand() - 0.5) * 24, (rand() - 0.5) * 10, -15 + rand() * 17, 0.7 + rand() * 1.6]);
  const position = new Float32Array(count * 3);
  const seed = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    if (rand() < 0.62) {
      const [x, y, z, spread] = groups[Math.floor(rand() * groups.length)];
      position.set([x + gauss() * spread, y + gauss() * spread * 0.7, z + gauss() * spread], i * 3);
    } else {
      position.set([(rand() - 0.5) * 28, (rand() - 0.5) * 13, -17 + rand() * 21], i * 3);
    }
    seed[i] = rand();
  }
  return { position, seed };
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
    uSize: { value: size },
    uPointer: { value: new Vector2() },
    uLens: { value: 0 },
    uAspect: { value: 1 },
    uColor: { value: new Color('#15151A') },
  },
  vertexShader: /* glsl */ `
    uniform float uTime, uFade, uSize, uLens, uAspect;
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

      float depth = -mv.z;
      gl_PointSize = uSize * (1.0 + focus * 0.7) / depth;
      vAlpha = uFade * (mix(0.1, 0.62, smoothstep(36.0, 13.0, depth)) + focus * 0.3);
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

  const count = coarse ? 1400 : 3000;
  const crowd = buildCrowd(count);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(crowd.position, 3));
  geometry.setAttribute('aSeed', new BufferAttribute(crowd.seed, 1));
  const points = new Points(geometry, crowdMaterial(46 * pixelRatio));
  const u = points.material.uniforms;

  const scene = new Scene();
  scene.add(points);
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);

  // Layout, recomputed on resize.
  let width = 0, height = 0, wide = true, region, ring, perCohort, spacing;
  const resize = () => {
    width = host.clientWidth;
    height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    camera.aspect = u.uAspect.value = width / height;
    wide = width >= 960;
    // On wide screens the crowd fills the right of the hero; the text keeps the left.
    // On narrow screens the field is its own block below the text.
    if (wide) camera.setViewOffset(width, height, -width * 0.2, 0, width, height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    region = wide
      ? { x: width * 0.6, y: height * 0.16, w: width * 0.34, h: height * 0.68 }
      : { x: width * 0.08, y: height * 0.16, w: width * 0.84, h: height * 0.68 };
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
      // Someone in focus: not too near, not too deep, inside the free area.
      if (p.depth < 13 || p.depth > 24) continue;
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
      if (p.depth < 11 || p.depth > 34) continue;
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
      const dx = p.x - f.parent.x, dy = p.y - f.parent.y;
      const len = Math.hypot(dx, dy) || 1;
      const gap = ring + 4;
      f.link.setAttribute('d', `M${(f.parent.x + dx / len * gap).toFixed(1)} ${(f.parent.y + dy / len * gap).toFixed(1)}L${(p.x - dx / len * gap).toFixed(1)} ${(p.y - dy / len * gap).toFixed(1)}`);
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

  const aim = (scrolled) => {
    camera.position.set(lookX, lookY, lerp(18, 13, ease(scrolled)));
    camera.lookAt(lookX * 0.2, lookY * 0.2, -4);
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

    lookX = lerp(lookX, pointerIn ? pointer.x * 1.6 : 0, 0.035);
    lookY = lerp(lookY, pointerIn ? pointer.y * 0.9 : 0, 0.035);
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
    hint.textContent = coarse ? 'Tap the crowd to find someone' : 'Click the crowd to find someone';
    host.append(hint);
  }

  requestAnimationFrame(() => host.classList.add('is-ready'));
}
