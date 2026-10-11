// Form endpoint. Leave empty until a form service is approved: while it is
// empty the form only shows a message and sends nothing anywhere.
const FORM_ENDPOINT = '';

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
    '.section .eyebrow, .section h2, .section .intro, .grid > *, .flow > li, .split > *, .stages > li, .outcomes, .numbered, .stuck, .faq, .fellows-note, .callout, .cta-band, .sectors'
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
  document.querySelectorAll('.photo, .photo-band').forEach((el) => pending.add(el));

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

    if (!FORM_ENDPOINT) {
      status.textContent = 'Thanks. This form is not live yet, so nothing was sent. Please check back soon.';
      return;
    }

    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(res.statusText);
      form.reset();
      syncRole();
      status.textContent = 'Thanks. We will be in touch.';
    } catch {
      status.textContent = 'Something went wrong. Please try again in a moment.';
    }
  });
}
