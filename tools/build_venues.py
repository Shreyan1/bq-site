"""Write venues.html from data/venues.json.

Run:  python3 website/tools/build_venues.py
Header and footer are copied from partners.html. Entries with "sample": true get a
Sample label, and while any sample is present the page is marked noindex.
"""

import html
import json
import re
from datetime import date
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
TYPES = {'college': 'College', 'coworking': 'Coworking space', 'office': 'Company office'}
TERMS = {'partner': 'Venue partner', 'paid': 'Paid'}
REGIONS = {'Delhi': 'Delhi', 'Gurugram': 'Haryana', 'Faridabad': 'Haryana', 'Noida': 'Uttar Pradesh', 'Ghaziabad': 'Uttar Pradesh'}

venues = json.loads((ROOT / 'data/venues.json').read_text())
e = lambda s: html.escape(str(s), quote=True)


def mailto(email, name):
    subject = quote(f"Event enquiry via Builders’ Quorum: {name}")
    body = quote("Hi,\n\nI found your space on Builders’ Quorum.\n\nEvent:\nDate and time:\n"
                 "People expected:\nOrganiser and community:\n\nThanks")
    return f'mailto:{e(email)}?subject={subject}&amp;body={body}'


def card(v):
    c = v['contact']
    maps = v.get('map_url') or 'https://www.google.com/maps/search/?api=1&query=' + quote(v['address'])
    rows = []
    if c.get('email'):
        rows.append(f'<div><dt>Email</dt><dd><a href="{mailto(c["email"], v["name"])}">{e(c["email"])}</a></dd></div>')
    if c.get('phone'):
        rows.append(f'<div><dt>Phone</dt><dd><a href="tel:{re.sub(r"[^0-9+]", "", c["phone"])}">{e(c["phone"])}</a></dd></div>')
    if c.get('whatsapp'):
        rows.append(f'<div><dt>WhatsApp</dt><dd><a href="https://wa.me/{re.sub(r"[^0-9]", "", c["whatsapp"])}" rel="noopener">{e(c["whatsapp"])}</a></dd></div>')
    if v.get('booking_url'):
        rows.append(f'<div><dt>Booking</dt><dd><a href="{e(v["booking_url"])}" rel="noopener">Book online</a></dd></div>')
    rows.append(f'<div><dt>Address</dt><dd>{e(v["address"])}. <a href="{e(maps)}" rel="noopener">Map</a></dd></div>')
    sample = ' <span class="tag tag-sample">Sample</span>' if v.get('sample') else ''
    return f'''          <li class="venue" id="{v['slug']}" data-area="{v['area'].lower()}" data-type="{v['type']}" data-seats="{v['seats']}" data-terms="{v['terms']}">
            <p class="venue-meta"><span>{e(v['area'])}</span><span>{TYPES[v['type']]}</span>{sample}</p>
            <h3>{e(v['name'])}</h3>
            <p class="venue-terms venue-terms-{v['terms']}">{TERMS[v['terms']]}<span>{e(v['terms_detail'])}</span></p>
            <dl class="venue-facts">
              <div><dt>Seats</dt><dd>{e(v['layouts'])}</dd></div>
              <div><dt>Notice</dt><dd>{e(v['notice'])}</dd></div>
              <div><dt>Nearest metro</dt><dd>{e(v['nearest_metro'])}</dd></div>
              <div><dt>Good for</dt><dd>{e(', '.join(v['good_for']))}</dd></div>
            </dl>
            <dl class="venue-contact">
              {(chr(10) + '              ').join(rows)}
            </dl>
            <p class="venue-confirmed">Last confirmed {date.fromisoformat(v['last_confirmed']).strftime('%-d %B %Y')}</p>
          </li>'''


def venue_data(v):
    data = {
        '@type': 'EventVenue',
        'name': v['name'],
        'description': v['about'],
        'url': f'venues.html#{v["slug"]}',
        'address': {'@type': 'PostalAddress', 'streetAddress': v['address'], 'addressLocality': v['area'],
                    'addressRegion': REGIONS.get(v['area'], ''), 'addressCountry': 'IN'},
        'maximumAttendeeCapacity': v['seats'],
        'amenityFeature': [{'@type': 'LocationFeatureSpecification', 'name': a, 'value': True} for a in v['amenities']],
    }
    if v['contact'].get('email'):
        data['email'] = v['contact']['email']
    if v['contact'].get('phone'):
        data['telephone'] = v['contact']['phone']
    return data


faq = [
    ('Where can I host a tech meetup in Delhi NCR?',
     f'This page lists {len(venues)} spaces across Delhi NCR that host tech meetups, hackathons and workshops, including '
     'colleges, coworking spaces and company offices. Each listing shows capacity, terms, the nearest metro and how to contact the host.'),
    ('Do these venues charge?',
     'Every space is either a venue partner or paid. A venue partner hosts in return for something it values, such as its name '
     'on the event or places for its students. A paid venue rents the space, often at a community rate.'),
    ('How do I book a space?',
     'Contact the host directly with the email, phone or booking link on the listing.'),
    ('Does Builder\'s Quorum charge for this?',
     'No. This is a free community list. Builder\'s Quorum takes no fee or commission from venues or organisers. '
     'If the list helps you find a room, a mention of Builder\'s Quorum on your event is welcome.'),
    ('How do I list my space?',
     'Fill in the short venue form. We confirm the details with you before the listing goes up, and you can change or remove it at any time.'),
]
faq_html = '\n'.join(f'''          <details>
            <summary>{e(q)}</summary>
            <p>{e(a)}</p>
          </details>''' for q, a in faq)

data = [
    {'@context': 'https://schema.org', '@type': 'ItemList', 'name': 'Venues for tech events in Delhi NCR',
     'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'item': venue_data(v)} for i, v in enumerate(venues)]},
    {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [
        {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in faq]},
]

areas = ''.join(f'<option value="{a.lower()}">{a}</option>' for a in REGIONS)
sketch = (ROOT / 'tools/venues-sketch.html').read_text().strip()
updated = max(v['last_confirmed'] for v in venues) if venues else date.today().isoformat()

main = f'''<main id="main">
    <section class="hero page-hero">
      <div class="wrap hero-grid">
        <div>
          <p class="hero-meta">Venues <i aria-hidden="true">/</i> Delhi NCR <i aria-hidden="true">/</i> Updated {date.fromisoformat(updated).strftime('%-d %B %Y')}</p>
          <h1>Find a room for your next <em>event</em>.</h1>
          <div class="hero-rest">
            <p class="lede">Colleges, coworking spaces and company offices across Delhi NCR that host tech meetups, hackathons and workshops. Every listing shows the capacity, the terms and how to reach the host.</p>
            <p class="venue-stats"><strong>{len(venues)}</strong> spaces <i aria-hidden="true">/</i> <strong>{sum(v['seats'] for v in venues):,}</strong> seats <i aria-hidden="true">/</i> <strong>{len({v['area'] for v in venues})}</strong> areas</p>
            <div class="actions">
              <a class="btn btn-primary btn-arrow" href="#spaces">Browse spaces</a>
              <a class="btn btn-ghost" href="apply.html?role=venue">List your space</a>
            </div>
            <p class="note">A free community list, kept by Builders’ Quorum. We take no fee or commission from venues or organisers. If it helps you find a room, a mention of BQ on your event is always welcome.</p>
          </div>
        </div>
        {sketch}
      </div>
    </section>

    <section class="section section-wash" id="spaces" aria-labelledby="spaces-title">
      <div class="wrap">
        <p class="eyebrow">Spaces</p>
        <h2 id="spaces-title">Rooms that host <em>builders</em>.</h2>
        <p class="intro">Every space is a venue partner, which hosts in return for something it values, or paid. Contact the host directly.</p>
        <form class="venue-filters" aria-label="Filter spaces">
          <div class="field">
            <label for="f-area">Area</label>
            <select id="f-area" name="area"><option value="">Anywhere in Delhi NCR</option>{areas}</select>
          </div>
          <div class="field">
            <label for="f-type">Type</label>
            <select id="f-type" name="type"><option value="">Any type</option><option value="college">College</option><option value="coworking">Coworking space</option><option value="office">Company office</option></select>
          </div>
          <div class="field">
            <label for="f-seats">People</label>
            <select id="f-seats" name="seats"><option value="0">Any size</option><option value="50">50 or more</option><option value="100">100 or more</option><option value="200">200 or more</option></select>
          </div>
          <div class="field">
            <label for="f-terms">Terms</label>
            <select id="f-terms" name="terms"><option value="">Venue partner or paid</option><option value="partner">Venue partner</option><option value="paid">Paid</option></select>
          </div>
          <p class="venue-count" role="status" aria-live="polite"></p>
        </form>
        <ul class="venue-list">
{chr(10).join(card(v) for v in venues)}
        </ul>
        <p class="venue-none" hidden>No listed space fits that yet.</p>
      </div>
    </section>

    <section class="section" id="hosts" aria-labelledby="hosts-title">
      <div class="wrap">
        <p class="eyebrow">For venues</p>
        <h2 id="hosts-title">List your <em>space</em>.</h2>
        <ul class="grid grid-3 cards">
          <li>
            <h3>Organisers who fit</h3>
            <p>Your listing reaches the people who run tech meetups, hackathons and workshops across Delhi NCR, through the communities we run.</p>
          </li>
          <li>
            <h3>Your terms, in plain words</h3>
            <p>Say what you want in return, whether that is your name on the event, places for your students or a fee.</p>
          </li>
          <li>
            <h3>The contact you choose</h3>
            <p>We publish the events email, number or booking link you give us, and you can change or remove it at any time.</p>
          </li>
        </ul>
        <div class="actions">
          <a class="btn btn-primary btn-arrow" href="apply.html?role=venue">List your space</a>
        </div>
      </div>
    </section>

    <section class="section" id="venue-faq" aria-labelledby="venue-faq-title">
      <div class="wrap">
        <p class="eyebrow">Questions</p>
        <h2 id="venue-faq-title">About these <em>venues</em>.</h2>
        <div class="faq">
{faq_html}
        </div>
      </div>
    </section>
  </main>'''

template = (ROOT / 'partners.html').read_text()
head, rest = template.split('<main id="main">', 1)
foot = rest.split('</main>', 1)[1]
title = "Venues for tech events in Delhi NCR | Builders’ Quorum"
desc = (f'{len(venues)} spaces across Delhi NCR that host tech meetups, hackathons and workshops, with capacity, '
        'terms and contact details for each.')
head = re.sub(r'<title>.*?</title>', f'<title>{e(title)}</title>', head)
head = re.sub(r'(<meta property="og:title" content=")[^"]*', lambda m: m.group(1) + e(title), head)
for attr in ('name="description"', 'property="og:description"'):
    head = re.sub(rf'(<meta {attr} content=")[^"]*', lambda m: m.group(1) + e(desc), head)
head = head.replace(' aria-current="page"', '').replace('<a href="venues.html">', '<a href="venues.html" aria-current="page">', 1)
extra = '  <meta name="robots" content="noindex">\n' if any(v.get('sample') for v in venues) else ''
extra += ''.join('  <script type="application/ld+json">\n' + json.dumps(d, indent=2, ensure_ascii=False) + '\n  </script>\n' for d in data)
head = head.replace('</head>', extra + '</head>')
(ROOT / 'venues.html').write_text(head + main + foot)
print(f'Wrote venues.html with {len(venues)} venues')
