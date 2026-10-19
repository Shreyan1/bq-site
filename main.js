// Form delivery: Web3Forms emails each submission to hello@buildersquorum.com. The access
// key is public by design (it can only send to that inbox). Leave it empty until the key
// has been emailed to that inbox: while it is empty the form sends nothing anywhere.
const FORM_ENDPOINT = 'https://api.web3forms.com/submit';
const FORM_ACCESS_KEY = 'd71b280b-35eb-4fa5-8d68-7c6d44b62ac5';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);

// Sections waiting on real names or venues stay hidden. Add ?preview to the URL to see them.
if (params.has('preview')) {
  document.querySelectorAll('[data-preview]').forEach((el) => { el.hidden = false; });
  document.querySelectorAll('[data-preview-hide]').forEach((el) => { el.hidden = true; });
}

// Venue filters: hide listings that don't match the area, type or size.
const filters = document.querySelector('.venue-filters');

if (filters) {
  const venues = [...document.querySelectorAll('.venue')];
  const count = filters.querySelector('.venue-count');
  const none = document.querySelector('.venue-none');

  const applyFilters = () => {
    const { area, type, seats, terms } = Object.fromEntries(new FormData(filters));
    let shown = 0;
    venues.forEach((v) => {
      const match = (!area || v.dataset.area === area)
        && (!type || v.dataset.type === type)
        && (!terms || v.dataset.terms === terms)
        && Number(v.dataset.seats) >= Number(seats);
      v.hidden = !match;
      if (match) shown++;
    });
    count.textContent = `${shown} ${shown === 1 ? 'space' : 'spaces'}`;
    none.hidden = shown > 0 || filters.hidden;
  };
  filters.addEventListener('change', applyFilters);
  filters.addEventListener('submit', (e) => e.preventDefault());
  applyFilters();
}

// Header gets a hairline once the page scrolls.
const header = document.querySelector('.site-header');
const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Mobile nav toggle.
const toggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('site-nav');

function setNav(open) {
  toggle.setAttribute('aria-expanded', String(open));
  nav.classList.toggle('is-open', open);
}

toggle.addEventListener('click', () => setNav(toggle.getAttribute('aria-expanded') !== 'true'));
nav.addEventListener('click', (e) => { if (e.target.closest('a')) setNav(false); });

// Journey dots: fewer at each stage. Illustrative, not data.
document.querySelectorAll('.dots').forEach((box) => {
  for (let i = 0; i < Number(box.dataset.count); i++) {
    const dot = document.createElement('i');
    dot.style.setProperty('--d', i);
    box.append(dot);
  }
});

// Scroll reveal and pencil sketches. Anything whose top has reached the lower part of
// the screen is marked as in, including things already scrolled past, so fast scrolling
// never leaves blank gaps.
if (!reduceMotion) {
  const pending = new Set();

  // Siblings get a stagger index so grids come in one by one.
  document.querySelectorAll(
    '.section .eyebrow, .section h2, .section .intro, .grid > *, .flow > li, .split > *, .stages > li, .outcomes, .numbered, .stuck, .faq, .fellows-note, .callout, .cta-band, .frontiers, .reel-strip, .reel-close > *'
  ).forEach((el) => {
    el.classList.add('reveal');
    el.style.setProperty('--i', [...el.parentElement.children].indexOf(el) % 4);
    pending.add(el);
  });

  // Each stroke in a sketch gets its own delay, so it draws like a pencil.
  document.querySelectorAll('.sketch').forEach((sketch) => {
    sketch.querySelectorAll('[pathLength]').forEach((stroke, i) => stroke.style.setProperty('--i', i));
    sketch.classList.add('draw');
    pending.add(sketch);
  });

  // The footer wordmark rises when the footer comes into view. The footer is checked, not
  // the wordmark, because the wordmark's own box is lowered until then.
  const footer = document.querySelector('.site-footer');
  if (footer) pending.add(footer);
  // Photographs open upwards as they arrive.
  document.querySelectorAll('.photo').forEach((el) => pending.add(el));

  let queued = false;
  const check = () => {
    queued = false;
    const line = window.innerHeight * 0.94;
    pending.forEach((el) => {
      if (el.getBoundingClientRect().top < line) {
        el.classList.add('is-in');
        pending.delete(el);
      }
    });
  };
  const queue = () => {
    if (!queued && pending.size) {
      queued = true;
      requestAnimationFrame(check);
    }
  };
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  check();
} else {
  // SMIL movers ignore CSS media queries, so stop them here.
  document.querySelectorAll('svg').forEach((svg) => svg.pauseAnimations?.());
}

// Home hero field (assets/field.js, about 120 KB with Three.js). It loads once the page
// is idle so it never holds up the text, and is skipped when data saver is on.
const fieldHost = document.querySelector('[data-field]');

if (fieldHost && navigator.connection?.saveData) {
  fieldHost.remove();
} else if (fieldHost) {
  const load = () => import('./assets/field.js')
    .then(({ default: mount }) => mount(fieldHost, { still: reduceMotion }))
    .catch(() => fieldHost.remove()); // No WebGL: the hero stays typographic.
  const idle = () => (window.requestIdleCallback ? requestIdleCallback(load, { timeout: 1200 }) : setTimeout(load, 200));
  if (document.readyState === 'complete') idle();
  else addEventListener('load', idle, { once: true });
}

// Statement: words light up in reading order as the paragraph moves up the screen.
const statement = document.querySelector('.statement-text');

if (statement && !reduceMotion) {
  const wrapWords = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType !== Node.TEXT_NODE) return wrapWords(child);
      const frag = document.createDocumentFragment();
      child.textContent.split(/(\s+)/).forEach((part) => {
        if (!part.trim()) return frag.append(part);
        const word = document.createElement('span');
        word.className = 'word';
        word.textContent = part;
        frag.append(word);
      });
      child.replaceWith(frag);
    });
  };
  wrapWords(statement);
  statement.classList.add('statement-live');

  const words = statement.querySelectorAll('.word');
  const light = () => {
    const box = statement.getBoundingClientRect();
    const progress = (window.innerHeight * 0.8 - box.top) / (box.height + window.innerHeight * 0.3);
    const lit = Math.round(Math.min(1, Math.max(0, progress)) * words.length);
    words.forEach((word, i) => word.classList.toggle('lit', i < lit));
  };
  window.addEventListener('scroll', () => requestAnimationFrame(light), { passive: true });
  light();
}

// Builders reel: a film strip that drifts to the left and loops. The track holds a second,
// hidden copy of the builders so the loop has no seam. It can be dragged, swiped, scrolled
// sideways on a trackpad or moved with the arrow keys, and it carries on with the momentum
// it was given before settling back to its drift. Pressing Pause eases it to a stop, a
// page scroll gives it a push, and the faster it moves the more the portraits lean into
// the motion. It only runs while it is on screen.
const strip = document.querySelector('.reel-strip');

if (strip && !reduceMotion) {
  const track = strip.querySelector('.reel-track');
  const toggle = document.querySelector('.reel-toggle');
  const SPEED = 70; // pixels per second at rest
  const EASE = 2.5; // how quickly the drift settles on its target speed, per second
  const FRICTION = 2.2; // how quickly momentum from a drag or scroll fades, per second
  const SCROLL_PUSH = 4; // pixels per second added for each pixel the page scrolls
  const MAX_SCROLL_PUSH = 900;
  const MAX_FLING = 2400;
  const KEY_PUSH = 700;
  const LEAN = 0.004; // degrees of lean per pixel per second of momentum
  const MAX_LEAN = 6;

  [...track.children].forEach((frame) => {
    const copy = frame.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    copy.inert = true;
    copy.querySelectorAll('img').forEach((img) => { img.alt = ''; });
    track.append(copy);
  });
  track.querySelectorAll('img').forEach((img) => { img.draggable = false; });
  strip.classList.add('is-moving');
  strip.tabIndex = 0;
  strip.setAttribute('role', 'region');
  strip.setAttribute('aria-label', 'Builders. Use the left and right arrow keys to move through them.');
  toggle.hidden = false;

  const clamp = (v, max) => Math.max(-max, Math.min(max, v));

  // Start with the first builder lined up with the text column, not in the faded edge.
  let loop = track.scrollWidth / 2;
  let offset = loop - document.querySelector('.reel-label').getBoundingClientRect().left;
  let speed = SPEED;
  let push = 0;
  let lean = 0;
  let drag = null;
  let paused = false;
  let held = false;
  let onScreen = false;
  let running = false;
  let last = 0;
  let lastScroll = window.scrollY;

  const wrap = (v) => ((v % loop) + loop) % loop;

  // Once the strip has eased to a stop it goes idle and asks for no more frames.
  const tick = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const target = paused || held ? 0 : SPEED;
    speed += (target - speed) * Math.min(1, dt * EASE);
    if (!drag) {
      push *= Math.exp(-dt * FRICTION);
      offset = wrap(offset + (speed + push) * dt);
    }
    lean += (clamp((drag ? drag.v : push) * LEAN, MAX_LEAN) - lean) * Math.min(1, dt * 8);
    track.style.transform = `translate3d(${-offset.toFixed(2)}px, 0, 0)`;
    track.style.setProperty('--lean', `${lean.toFixed(3)}deg`);
    const settled = !drag && target === 0 && Math.abs(speed) + Math.abs(push) + Math.abs(lean) < 0.5;
    if (settled) speed = push = lean = 0;
    running = onScreen && !settled;
    if (running) requestAnimationFrame(tick);
  };
  const wake = () => {
    if (running || !onScreen) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(tick);
  };

  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    wake();
  }).observe(strip);

  // Dragging moves the strip with the pointer; letting go hands its speed over as momentum.
  strip.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, t: e.timeStamp, v: 0 };
    strip.setPointerCapture(e.pointerId);
    strip.classList.add('is-dragging');
    wake();
  });
  strip.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dt = Math.max(1, e.timeStamp - drag.t) / 1000;
    offset = wrap(offset - dx);
    drag.v += (-dx / dt - drag.v) * 0.4;
    drag.x = e.clientX;
    drag.t = e.timeStamp;
  });
  const release = (e) => {
    if (!drag) return;
    const still = e.timeStamp - drag.t > 80;
    push = still ? 0 : clamp(drag.v - speed, MAX_FLING);
    drag = null;
    strip.classList.remove('is-dragging');
    wake();
  };
  strip.addEventListener('pointerup', release);
  strip.addEventListener('pointercancel', release);

  strip.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    offset = wrap(offset + e.deltaX);
    push = clamp(push + e.deltaX * 2, MAX_FLING);
    wake();
  }, { passive: false });

  strip.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    push = clamp(push + step * KEY_PUSH, MAX_FLING);
    wake();
  });
  // Keyboard focus holds the drift so the arrow keys are in charge; a click to drag does not.
  strip.addEventListener('focus', () => { held = strip.matches(':focus-visible'); });
  strip.addEventListener('blur', () => {
    held = false;
    wake();
  });

  toggle.addEventListener('click', () => {
    paused = !paused;
    toggle.toggleAttribute('data-paused', paused);
    toggle.textContent = paused ? 'Play' : 'Pause';
    wake();
  });

  window.addEventListener('scroll', () => {
    const delta = window.scrollY - lastScroll;
    lastScroll = window.scrollY;
    if (!onScreen || paused || drag) return;
    push = clamp(push + delta * SCROLL_PUSH, MAX_SCROLL_PUSH);
    wake();
  }, { passive: true });
  window.addEventListener('resize', () => { loop = track.scrollWidth / 2; });
}

// Builders reel opening: its lines come out of a blur one after another as the block moves
// up the screen, and blur again when it moves back down. Scroll position drives it, so it
// never holds the page.
const opening = document.querySelector('.reel-open');

if (opening && !reduceMotion) {
  opening.querySelectorAll('.reel-line').forEach((line, i) => line.style.setProperty('--i', i));
  opening.classList.add('is-scrubbed');
  let queued = false;
  const scrub = () => {
    queued = false;
    const progress = (window.innerHeight * 0.9 - opening.getBoundingClientRect().top) / (window.innerHeight * 0.6);
    opening.style.setProperty('--open', Math.min(1, Math.max(0, progress)).toFixed(3));
  };
  window.addEventListener('scroll', () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(scrub);
    }
  }, { passive: true });
  window.addEventListener('resize', scrub);
  scrub();
}

// Frontiers: the hover fill grows from where the pointer comes in and shrinks towards
// where it leaves.
document.querySelectorAll('.frontiers li').forEach((cell) => {
  const aim = (e) => {
    const r = cell.getBoundingClientRect();
    cell.style.setProperty('--x', `${((e.clientX - r.left) / r.width) * 100}%`);
    cell.style.setProperty('--y', `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  cell.addEventListener('pointerenter', aim);
  cell.addEventListener('pointerleave', aim);
});

// "What's stopping you" tabs. Without JS every answer is shown.
const tabs = [...document.querySelectorAll('.stuck [role="tab"]')];

function selectTab(tab) {
  tabs.forEach((t) => {
    const selected = t === tab;
    t.setAttribute('aria-selected', String(selected));
    t.tabIndex = selected ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !selected;
  });
}

tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => {
    selectTab(tab);
    // On narrow screens the answer sits below the list, so bring it into view.
    if (window.matchMedia('(max-width: 55.99rem)').matches) {
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      panel.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  });
  tab.addEventListener('keydown', (e) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = tabs[(i + step + tabs.length) % tabs.length];
    selectTab(next);
    next.focus();
  });
});
if (tabs.length) selectTab(tabs[0]);

// Apply form: each role sees its own questions, and the button label follows the role.
const form = document.getElementById('interest-form');

if (form) {
  const role = form.elements.role;
  const roleFields = document.querySelectorAll('fieldset[data-for], .apply-aside [data-for]');
  const org = document.getElementById('org');
  const orgOptional = document.getElementById('org-optional');
  const submit = document.getElementById('submit');
  const status = document.getElementById('form-status');

  const orgLabel = document.getElementById('org-label');
  const submitLabels = {
    campus: 'Start the conversation', partner: 'Start the conversation', investor: 'Start the conversation',
    member: 'Ask to join', speaker: 'Offer a session', practitioner: 'Share the problem', student: 'Join the list',
    reader: 'Send me the first issue', organiser: 'Send', venue: 'List my space',
  };
  const orgLabels = {
    campus: 'University or institution', partner: 'Enterprise', investor: 'Fund or firm', member: 'University, lab or company',
    practitioner: 'Company or organisation',
    speaker: 'University or institute', student: 'University or college', organiser: 'Community or organisation',
    venue: 'Name of the space',
  };
  const needsOrg = ['member', 'speaker', 'student', 'campus', 'partner', 'organiser', 'venue'];

  const syncRole = () => {
    roleFields.forEach((group) => {
      const active = group.dataset.for.split(' ').includes(role.value);
      group.hidden = !active;
      if (group.matches('fieldset')) group.disabled = !active; // disabled fields skip validation and aren't sent
    });
    org.required = needsOrg.includes(role.value);
    orgOptional.hidden = org.required;
    submit.textContent = submitLabels[role.value] || 'Send';
    orgLabel.textContent = orgLabels[role.value] || 'Institution or organisation';
  };

  // Links like apply.html?role=investor arrive with the role already chosen. The venue
  // roles only show up for people who come from the venues page.
  const wanted = [...role].find((input) => input.value === params.get('role'));
  if (wanted) {
    wanted.checked = true;
    wanted.closest('[data-local]')?.removeAttribute('hidden');
  }
  if (params.get('venue')) document.getElementById('venue-pick').value = params.get('venue');

  form.addEventListener('change', (e) => { if (e.target.name === 'role') syncRole(); });
  syncRole();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!FORM_ACCESS_KEY) {
      status.textContent = 'Thanks. This form is not live yet, so nothing was sent. Please write to hello@buildersquorum.com instead.';
      return;
    }

    try {
      const data = new FormData(form);
      data.append('access_key', FORM_ACCESS_KEY);
      data.append('from_name', 'Builders’ Quorum website');
      data.append('subject', `BQ website: ${data.get('role')} (${data.get('name') || 'no name'})`);
      const res = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || res.statusText);
      form.reset();
      syncRole();
      status.textContent = 'Thanks. We will be in touch.';
    } catch {
      status.textContent = 'Something went wrong. Please try again in a moment or write to hello@buildersquorum.com.';
    }
  });
}
