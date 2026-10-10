# Builder's Quorum website (v1)

Plain HTML, CSS and a little JS. No framework. Only venues.html is generated (see below). Not deployed.

```
index.html        home: hero, an evening, why BQ (the moat), how BQ grows, four doors, access is earned, FAQ
evenings.html     the evenings, for researchers and technology professionals: what most events miss, how an
                  evening works, who is in the room, topics, lead an evening (speakers), how a seat is earned
universities.html university chapters (phase two): what students get, journey and Fellows, tracks, what it
                  takes, how a pilot works, proven formats
partners.html     for companies, sponsors and practitioners, plus the hidden "Backed by" section
investors.html    for investors: join an evening, angel and pre-seed first, later stages as mentors and judges
venues.html       generated: one open page listing spaces for tech events, with capacity, terms, contact
                  details, filters and an FAQ. Built from data/venues.json by tools/build_venues.py
apply.html        one form; the questions change with the role. Links can preselect a role:
                  apply.html?role=member | speaker | campus | student | investor | partner | practitioner
                  | reader | organiser | venue
                  apply.html?role=organiser&venue=Name fills in the space the organiser picked
styles.css        design tokens at the top, then components, then motion
main.js           nav, scroll reveal, sketch drawing, tabs, form
assets/          logo.svg (icon in header and footer), favicon.svg, apple-touch-icon.png. Copied from ../logo
favicon.ico       16, 32 and 48 px, also from ../logo
404.html, robots.txt, sitemap.xml
```

The header, footer and pencil filter are repeated on every page. If you change one, change all seven.

## Preview locally

```bash
python3 -m http.server 8000 --directory website
```

Then open http://localhost:8000.

## Common changes

- Logo: the chosen mark (11 October 2026) lives in `../logo`, with its own README and build scripts. To update the site, copy `svg/bq-icon.svg` to `assets/logo.svg`, `svg/bq-favicon.svg` to `assets/favicon.svg`, `png/apple-touch-icon.png` to `assets/` and `favicon.ico` to the site root.
- Accent colour: change `--accent` in `styles.css`. `--accent-ink` and `--accent-wash` are derived from it.
- Form: set `FORM_ENDPOINT` in `main.js` once a form service is approved. While it is empty, the form sends nothing.
- FAQ: the answers appear twice in `index.html`, in the visible FAQ and in the FAQPage JSON-LD in `<head>`. Edit both.
- Backed by: `#backers` in `partners.html` is hidden. Open `partners.html?preview` to see it. Only name people and organisations who have agreed in writing.
- Venues: edit `data/venues.json`, then run `python3 website/tools/build_venues.py`. Don't edit `venues.html` by hand. Listings are labelled venue partner or paid, and contact details are shown in full so search engines and AI assistants can read them. Publish only the contacts a venue has agreed to in writing. While any entry has `"sample": true` the page is marked noindex; delete the samples before launch, then add `venues.html` to the sitemap if it isn't there.

## Design system

- Type: Instrument Serif for display, with italics for one word per heading. Inter Tight 400 for body text and 500 for interface text (buttons, labels, navigation, small headings).
- Colour: ink on warm paper (#FBFAF7) with a faint grain, one accent used sparingly. The "access is earned" band (home and evenings pages) and the footer are the only dark areas.
- Shape and layout: square corners and hairlines throughout. Buttons and labels use small tracked capitals. On wide screens each section has a sticky left column with its number (01, 02...) and label, and the content sits on the right. The home page has a ticker of sectors and formats, a large statement that lights up word by word as you scroll, and every page ends with a large wordmark.
- Spacing: section padding tops out at 7rem, and the sticky left column starts at 56rem (896px). The closing call-to-action band splits into heading left and text and buttons right from the same width, so no block leaves half the width empty.
- The style sheet is layered: base styles first, then "Layout v2", then the "Refinement pass", which overrides earlier rules. When changing a component, check the refinement pass first.
- Pencil sketches: inline SVG strokes in graphite, with one accent element each. A shared `#pencil` filter roughens the lines. Each stroke has `pathLength="1"`, so CSS can draw it in. To add a sketch, give it `class="sketch"`, put the strokes inside a `<g>`, and give every stroke `pathLength="1"`.
- Living sketches: once drawn, parts keep moving. The rocket bobs and its flame flickers, the pencil writes, the flag waves, the seedling sways and sticky notes wiggle. Dots travel along paths (SMIL `animateMotion`, made by `mover()`), and hero sketches "boil" by swapping between three pencil filters. Moving parts are nested `<g>` groups with classes like `bob`, `sway` or `wave`.
- Motion: on page load the headline rises in and the underline under "founders" draws. Sketches draw stroke by stroke as they scroll into view. Reveals are triggered by scroll position, not IntersectionObserver, so anything already scrolled past is shown at once and fast scrolling never leaves gaps. Other content fades up as you scroll, and there is a reading-progress line under the header. Pages cross-fade in browsers that support view transitions. All motion switches off for `prefers-reduced-motion`, and content stays visible without JS.
- Chrome gotcha: match sketch strokes by tag (`path`, `circle`), not with `[pathLength]` selectors. Chrome doesn't restyle camelCase SVG attribute selectors when an ancestor's class changes.

## Before going live

- [ ] Trademark check (IP India, classes 41 and 35) is clean
- [ ] Domain bought. Then add canonical links, `og:url`, and a `url` and `logo` in the Organization JSON-LD. Replace `YOUR-DOMAIN` in `sitemap.xml` and uncomment the sitemap line in `robots.txt`
- [ ] Trademark check on the logo as a device mark, as well as the name
- [ ] Registration and payment for the evenings: pick the tool, put it on a subdomain, and link it from invitations. The request form on this site only collects requests
- [ ] 1200x630 PNG for `og:image`
- [ ] Form endpoint approved and set, plus a privacy note next to the form
- [ ] Contact email in the footer
- [ ] Venues: about 20 confirmed listings with photos before the page is shared, each with written agreement to publish its contact, and a named owner who rechecks every listing every three months

## Copy that still needs founder sign-off

The direction changed on 11 October 2026: evenings first, university chapters next. These lines carry the new direction and need a yes from all three founders.

- The evenings have no name yet. The site says "the evenings", "a BQ evening" and "Evening 01" in the home hero. Swap in the name once chosen (never "Quorum" alone)
- Audience: "PhD and master's researchers, engineers and technology professionals" and "the evenings aren't open to undergraduates"
- The fee: "a reservation fee holds your seat, and all of it is redeemable against food and drink at the venue". Confirm each venue agrees to this before the first evening. The amount is only ever stated in the invitation
- How seats are given: an invitation from a speaker or a member, or a request read by the team. "People who keep showing up keep being invited" and "we will tell you either way" each need someone who owns them
- "A few founders and investors at each evening" and "nobody pitches". Only keep the first once some have agreed to come
- The speaker promises: "What we handle" and "What we ask of you" on the evenings page, including "slides only if they help"
- How BQ grows: evenings now, university chapters next, then Bengaluru, Mumbai, Hyderabad and Pune with sponsors. Naming the cities is a public commitment
- Topics: deep tech first (AI and cloud, robotics, semiconductors, advanced materials, space tech, energy), with fintech, real estate and food and agri-tech when a speaker brings a problem
- Universities: chapters "co-branded with your university", "chapters open after the first evenings", and whether chapter students pay. The site doesn't say they pay
- "Why BQ" names Claude Developers India ("more than 1,000 AI builders") and ML Reading Club Delhi NCR. Confirm you are happy to name both, and that the number is current
- Partners page: "send a speaker or an engineer" and "take the evenings to a new city"
- BQ Fellows (universities page): "You can't apply", "If a cohort doesn't produce one, we don't name one", and what Fellows get
- Universities pilot: "No fixed session counts and no long contracts up front", and "We share the numbers, good or bad"
- Example problems on the universities page come from the proposal's Annexure A. Swap them for live problems when you have them
- Proven formats on the universities page: names Stanford GSB, MIT Sloan and Oxford Saïd programmes as inspiration, with a no-affiliation note. Keep or cut
- Venues page: "you can change or remove it at any time" and "through the communities we run"

## Naming

"BQ Fellow" and "The BQ Brief" are used instead of "Quorum Fellow" and "Quorum Brief" until trademark clearance. Always write the brand as "Builder's Quorum" or "BQ", never "Quorum" alone.

Research behind the student material (now on the universities page) and the student questions in the form is in `../research/student-demand.md`. The survey draft is in `../survey/bq-survey.md`.
