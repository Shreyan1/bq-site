# Builder's Quorum website (v1)

Plain HTML, CSS and a little JS. No build step and no framework. Not deployed.

```
index.html        home: hero, what you get, why BQ (the moat), four doors, Fellows, FAQ
builders.html     for students and early builders (from any college or none): what's stopping you, how it works,
                  sprint stages, formats, tracks, outcomes, journey, BQ Fellows, proven formats
colleges.html     for colleges and student bodies: what you get, how a pilot works, who runs BQ
partners.html     for sponsors, companies and practitioners, plus the hidden "Backed by" section
investors.html    for investors: angel and pre-seed first, later stages as mentors and judges
venues.html       a directory of spaces for community events. Each listing shows its terms (venue partner
                  or paid) and the contact the venue agreed to publish, so organisers talk to hosts directly.
                  Filters, open dates posted by venues, and a pitch to venues. Samples show only with ?preview
apply.html        one form; the questions change with the role. Links can preselect a role:
                  apply.html?role=campus | builder | investor | partner | practitioner | reader | organiser | venue
                  apply.html?role=organiser&venue=Name fills in the space the organiser picked
styles.css        design tokens at the top, then components, then motion
main.js           nav, scroll reveal, sketch drawing, tabs, form
assets/logo.svg   the only logo file (header, footer, favicon)
404.html, robots.txt, sitemap.xml
```

The header, footer and pencil filter are repeated on every page. If you change one, change all seven.

## Preview locally

```bash
python3 -m http.server 8000 --directory website
```

Then open http://localhost:8000.

## Common changes

- Logo: replace `assets/logo.svg`. Keep a square viewBox. The current file is a placeholder.
- Accent colour: change `--accent` in `styles.css`. `--accent-ink` and `--accent-wash` are derived from it.
- Form: set `FORM_ENDPOINT` in `main.js` once a form service is approved. While it is empty, the form sends nothing.
- FAQ: the answers appear twice in `index.html`, in the visible FAQ and in the FAQPage JSON-LD in `<head>`. Edit both.
- Backed by: `#backers` in `partners.html` is hidden. Open `partners.html?preview` to see it. Only name people and organisations who have agreed in writing.
- Venues: listings live in `#spaces` in `venues.html`, one `<li class="venue">` each. The `data-area`, `data-type`, `data-seats` and `data-terms` (`partner` or `paid`) attributes drive the filters. "Email the host" is a `mailto:` link with the subject and a short template filled in, so venues can see the enquiry came through BQ. Add "Book online" only for venues with their own booking or Luma link. Open dates live in `#open-dates`. Samples are hidden; open `venues.html?preview` to see them. To go live, replace the samples, remove `hidden` from the filters, the list and `#open-dates`, and delete the `venue-empty` block. Publish only the contact details a venue has agreed to in writing, and update "Last confirmed" on every recheck.

## Design system

- Type: Instrument Serif for display, with italics for one word per heading. Inter Tight 400 for body text and 500 for interface text (buttons, labels, navigation, small headings).
- Colour: ink on warm paper (#FBFAF7) with a faint grain, one accent used sparingly. The Fellows band and the footer are the only dark areas.
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
- [ ] Final logo in `assets/logo.svg`
- [ ] 1200x630 PNG for `og:image`, and a 180x180 `apple-touch-icon`
- [ ] Form endpoint approved and set, plus a privacy note next to the form
- [ ] Contact email in the footer
- [ ] Venues: about 20 confirmed listings with photos before the page is shared, each with written agreement to publish its contact, and a named owner who rechecks every listing every three months

## Copy that still needs founder sign-off

- "Why BQ" names Claude Developers India ("more than 1,000 AI builders") and ML Reading Club Delhi NCR. Confirm you are happy to name both, and that the number is current
- Engineer mentorship and workshops ("engineers from large technology companies, AI labs and startups in our networks run workshops and mentor pods directly"). Only keep this once at least a few engineers have confirmed. Never name a company until it has signed
- "Lend your engineers" and "co-host a flagship event" on the partners page

- Scope: "students and early builders, from any college or none". This widens the concept note, which targets students. Decide whether direct applicants join campus cohorts or get their own
- "Starting in Delhi NCR", the two pilot tracks, and "Small cohorts, by application"
- One sprint covering Discover, Build, Fund and Grow. In six weeks that is a lot. Cut stages or lengthen the sprint if needed
- Example problems come from the proposal's Annexure A. Swap them for live problems from practitioners when you have them
- BQ Fellows: "You can't apply", "chosen for what you build, not where you study", "If a cohort doesn't produce a Fellow, we don't name one", and the benefits list, including investor introductions. Only promise investor introductions once at least two investors have agreed
- Colleges: "No fixed session counts and no long contracts up front", and "We share the numbers, good or bad"
- Apply page: "Not everyone gets in, and we will tell you either way". Only keep this if someone owns replying to everyone
- "If it isn't worth a Sunday afternoon, we don't run it"
- Venues page: "We check each listing with the venue before it goes up, and recheck it every three months" (only if someone owns it), and "We know more spaces than we list"
- Proven formats on the builders page: names Stanford GSB, MIT Sloan and Oxford Saïd programmes as inspiration, with a no-affiliation note. Keep or cut

## Naming

"BQ Fellow" and "The BQ Brief" are used instead of "Quorum Fellow" and "Quorum Brief" until trademark clearance. Always write the brand as "Builder's Quorum" or "BQ", never "Quorum" alone.

Research behind the "What's stopping you" section and the application questions is in `../research/student-demand.md`. The survey draft is in `../survey/bq-survey.md`.
