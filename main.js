// Form endpoint. Leave empty until a form service is approved: while it is
// empty the form only shows a message and sends nothing anywhere.
const FORM_ENDPOINT = '';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);

// The backers section stays hidden until it has real names. Add ?preview to the URL to see it.
const backers = document.getElementById('backers');
if (backers && params.has('preview')) backers.hidden = false;

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
  const role = document.getElementById('role');
  const roleFields = form.querySelectorAll('fieldset[data-for]');
  const org = document.getElementById('org');
  const orgOptional = document.getElementById('org-optional');
  const submit = document.getElementById('submit');
  const status = document.getElementById('form-status');

  const submitLabels = { student: 'Apply for a place', builder: 'Apply for a place', campus: 'Start the conversation' };
  const needsOrg = ['campus', 'investor', 'partner'];

  const syncRole = () => {
    roleFields.forEach((group) => {
      const active = group.dataset.for.split(' ').includes(role.value);
      group.hidden = !active;
      group.disabled = !active; // disabled fields skip validation and aren't sent
    });
    org.required = needsOrg.includes(role.value);
    orgOptional.hidden = org.required;
    submit.textContent = submitLabels[role.value] || 'Send';
  };

  // Links like apply.html?role=investor arrive with the role already chosen.
  const wanted = params.get('role');
  if ([...role.options].some((o) => o.value === wanted)) role.value = wanted;

  role.addEventListener('change', syncRole);
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
