# Builders’ Quorum website (v1)

Plain HTML, CSS and a little JS. No framework. Only venues.html and assets/field.js are generated (see below). Prepared for GitHub Pages at https://buildersquorum.com.

```
index.html        home: hero (the "found" crowd), what we do (curation), the student journey, why BQ,
                  four doors, pilot first, FAQ
universities.html the main customer page: what students get, journey and Fellows, tracks, what a
                  university gets, how a pilot works, proven formats
partners.html     for companies, sponsors and practitioners: hackathons, live problems, engineers, backing
                  a chapter or city, plus the hidden "Backed by" section
investors.html    for investors: angel and pre-seed first, later stages as mentors, judges and problem owners
network.html      the network of researchers, engineers, founders and investors: what members do, how the
                  network meets (invitation-only sessions), how members are chosen
venues.html       generated: one open page listing spaces for tech events, with capacity, terms, contact
                  details, filters and an FAQ. Built from data/venues.json by tools/build_venues.py
apply.html        "Work with us", written as a short letter in numbered parts. Four main ways in (university,
                  company, investor, network member) and four smaller ones; the questions and the "What
                  happens next" column change with the choice. It opens on universities. The organiser and
                  venue options only appear when a link from the venues page asks for them.
                  Links can preselect a role:
                  apply.html?role=campus | partner | investor | member | practitioner | speaker | student
                  | reader | organiser | venue
                  apply.html?role=organiser&venue=Name fills in the space the organiser picked
styles.css        design tokens at the top, then components, then motion
main.js           nav, scroll reveal, sketch drawing, tabs, form, and lazy-loading the hero field
src/field.js      the home hero's Three.js scene. Built into assets/field.js with `npm install` then
                  `npm run build` (run inside website/). Commit the built file; the site needs no build
assets/fonts/     self-hosted woff2 files (Latin only) with their OFL licences, declared at the top of styles.css
src/land.json     the world's land as a grid of dots for the hero map (about 12,800 dots, 7 KB). Rebuild
                  with `npm run land` (tools/build_land.mjs: Natural Earth 1:50m via world-atlas, Miller
                  projection, spherical land test with d3-geo; takes about two minutes)
assets/photos/    nine photographs at 1000 and 2000 px wide, WebP. Credits below
assets/          logo.svg (icon in header and footer), favicon.svg, apple-touch-icon.png. Copied from ../logo
favicon.ico       16, 32 and 48 px, also from ../logo
404.html, robots.txt, sitemap.xml
```

The header, footer and pencil filter are repeated on every page. If you change one, change all eight. 404.html uses root-relative links (`/network.html`) so it works at any path.

## Preview locally

```bash
python3 -m http.server 8000 --directory website
```

Then open http://localhost:8000.

## Deploy to GitHub Pages

GitHub Actions publishes the static pages and assets on each push to `main`. In GitHub, open **Settings → Pages** and set the source to **GitHub Actions**. The `CNAME` file sets the custom domain to `buildersquorum.com`. The repository must have GitHub Pages available for its visibility and plan.

In GoDaddy DNS for `buildersquorum.com`, point the apex (`@`) to GitHub Pages with four A records: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, and `185.199.111.153`. Add a CNAME record for `www` pointing to `Shreyan1.github.io`. Keep unrelated MX and TXT records (for email and domain verification). Remove only conflicting website records for `@` or `www`. After DNS resolves, return to **Settings → Pages**, confirm the custom domain is `buildersquorum.com`, and enable **Enforce HTTPS** when GitHub offers it. DNS changes can take up to 24 hours to propagate.

## Common changes

- Logo: the chosen mark (11 October 2026) lives in `../logo`, with its own README and build scripts. To update the site, copy `svg/bq-icon.svg` to `assets/logo.svg`, `svg/bq-favicon.svg` to `assets/favicon.svg`, `png/apple-touch-icon.png` to `assets/` and `favicon.ico` to the site root.
- Accent colour: change `--accent` in `styles.css`. `--accent-ink` and `--accent-wash` are derived from it.
- Form: set `FORM_ENDPOINT` in `main.js` once a form service is approved. While it is empty, the form sends nothing.
- FAQ: the answers appear twice in `index.html`, in the visible FAQ and in the FAQPage JSON-LD in `<head>`. Edit both.
- Backed by: `#backers` in `partners.html` is hidden. Open `partners.html?preview` to see it. Only name people and organisations who have agreed in writing.
- Venues: edit `data/venues.json`, then run `python3 website/tools/build_venues.py`. Don't edit `venues.html` by hand. Listings are labelled venue partner or paid, and contact details are shown in full so search engines and AI assistants can read them. Publish only the contacts a venue has agreed to in writing. While any entry has `"sample": true` the page is marked noindex; delete the samples before launch, then add `venues.html` to the sitemap if it isn't there.

## Design system

- Type: Gloock for display and headings. It has one upright weight, so serif text is never italic or bold, and font synthesis is off so browsers never fake either. Urbanist for everything else: 400 for body text, 500 for interface text (buttons, labels, navigation, small headings) and 800 for the wordmark. To rebuild the fonts, subset to Latin and convert to woff2 with fontTools, keeping the name table, and limit Urbanist's weight axis to 400–800.
- Colour: ink on warm paper (#FBFAF7) with a faint grain, one accent used sparingly. The header and the footer are the only dark areas: they frame every page, and everything between them stays light. The `.section-ink` style is still in the stylesheet but no page uses it. In the wordmark (header, footer and the large closing mark) the apostrophe and the full stop are always the accent colour: `Builders<span class="accent">’</span> Quorum<span class="accent">.</span>`. Running text spells the name plainly.
- Shape and layout: square corners and hairlines throughout, except buttons, which are pills. Buttons and labels use small tracked capitals. On hover a button's fill rises from its bottom edge, and the arrow on a primary button sits in its own disc and turns towards where it leads. On wide screens each section has a sticky left column with its number (01, 02...) and label, and the content sits on the right. The home page has a ticker of sectors and formats, a large statement that lights up word by word as you scroll, and every page ends with a large wordmark.
- Spacing: section padding tops out at 7rem, and the sticky left column starts at 56rem (896px). The closing call-to-action band splits into heading left and text and buttons right from the same width, so no block leaves half the width empty.
- The style sheet is layered: base styles first, then "Layout v2", then the "Refinement pass", which overrides earlier rules. When changing a component, check the refinement pass first.
- Pencil sketches: inline SVG strokes in graphite, with one accent element each. A shared `#pencil` filter roughens the lines. Each stroke has `pathLength="1"`, so CSS can draw it in. To add a sketch, give it `class="sketch"`, put the strokes inside a `<g>`, and give every stroke `pathLength="1"`.
- Living sketches: once drawn, parts keep moving. The rocket bobs and its flame flickers, the pencil writes, the flag waves, the seedling sways and sticky notes wiggle. Dots travel along paths (SMIL `animateMotion`, made by `mover()`), and hero sketches "boil" by swapping between three pencil filters. Moving parts are nested `<g>` groups with classes like `bob`, `sway` or `wave`.
- Hero map (home only): the world's land drawn as ink dots, each one a person, across the full width of the hero (faint behind the text, full on the right). The map is flat and in true proportion (Miller projection, 84°N to 56°S), so continents keep the shapes people know; don't tilt or stretch it. Every couple of seconds someone is found: circled in pencil, labelled with the industry that found them, and linked to the nearest earlier find by an arc. Only the newest circle is in the accent. Near the pointer people come into focus and gather in, the camera shifts with it, a faint circle offers the nearest person and clicking (or tapping) finds them. The scene loads after the page is idle (about 130 KB gzipped), pauses off screen and in background tabs, shows one finished cohort for reduced motion, and is removed for data saver or when WebGL fails. On narrow screens it is a figure below the buttons. Tune it in `src/field.js`, then `npm run build`.
- Photographs: warm black and white (grayscale with a little sepia), as full-bleed bands between sections, a pair on the home page and three captioned sectors (robotics, space tech, energy) under the frontiers grid. Each one shows what its page is about: students building on the home page, a hackathon for companies, a pitch for investors, a small technical session for the network. Avoid stock that only signals "technology" (chips, circuit boards), and avoid close-up faces and visible brands. They open upwards as they arrive. They are atmosphere, so `alt` is empty, and none of them is presented as BQ's own people or events. Replace them with photographs from real BQ chapters and sessions when there are some.
- Global first: nothing outside the footer says where BQ is based. Language tags are en-GB and spelling is British.
- Accent discipline: vermilion means "chosen". It marks the newest find in the home hero, the BQ Fellow step, the one key stroke in each sketch, the brand mark and the current page in the nav. Sub-heading underlines, callouts, note bullets, FAQ toggles, section markers and tags are ink. Keep it that way when adding sections.
- Speed: fonts are self-hosted and the two above the fold are preloaded, so no request leaves the site before text renders. The paper grain carries its own alpha instead of using `mix-blend-mode`, which made every scroll frame repaint the whole page.
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

## Positioning

Universities and institutions are the customers. BQ turns their most ambitious students into founders by curating the investors, mentors, engineers and live problems around them, running sprints, hackathons and Demo Night, and staying with the strongest teams towards a company. The invitation-only technical sessions (the evenings) exist to build and keep that network. On the site they appear only as "how the network meets" on network.html. Don't describe their format, venues, food or fees anywhere public, and don't present them as the product or the moat.

The writing follows how the strongest programmes describe themselves (Entrepreneur First, South Park Commons, Creative Destruction Lab, Conception X, Schwarzman Scholars): one sentence that states the offer and the audience, the product named plainly ("Our work is curation"), selectivity shown as a standard rather than claimed with words like exclusive or elite, and the model described as a few named parts.

## Copy that still needs founder sign-off

The positioning was corrected on 11 October 2026: universities are the customer and the evenings are a way to build the network. These lines need a yes from all three founders.

- Home: "Builders’ Quorum (BQ) turns a university’s most ambitious students into founders. We curate the investors, mentors, engineers and problems around them, and stay with the strongest teams from a first problem to a first company"
- Home: "Our work is curation" and "Ambitious students are everywhere. The people and problems that turn them into founders are much harder to find"
- Home top line: "Venture creation / Frontier sectors / Worldwide"
- Hackathons and flagship events "with technology companies". No company is named; keep it that way until one agrees in writing
- "Why BQ" says "we run practitioner communities of more than 1,000 AI builders and researchers" without naming them, so the site reads as global. Confirm the number is current
- Universities: chapters "co-branded with your university", "a clear account after every sprint of what worked and what didn’t", and whether chapter students pay. The site doesn't say who pays
- Universities pilot: "No fixed session counts and no long contracts up front", and "We share the numbers, good or bad"
- BQ Fellows: "You can't apply", "If a cohort doesn't produce one, we don't name one", and what Fellows get (one-to-one time with founders, introductions to investors)
- Network page: "Membership is by invitation", what members do, and "the network stays small on purpose"
- Companies page: "Back a chapter or a city", "help take BQ to a new city or country"
- FAQ "Where does BQ work?": "With a small number of universities at a time, wherever their students are. The network works across borders, online and in person"
- Work with us: "One of the founders reads every message and writes back", "Read by one of the founders. Never shared outside the BQ team", and the "What happens next" steps for each role (for example "As teams form, you hear about the ones that fit before anyone else does" for investors)
- Example problems on the universities page come from the proposal's Annexure A. Swap them for live problems when you have them
- Proven formats on the universities page: names Stanford GSB, MIT Sloan and Oxford Saïd programmes as inspiration, with a no-affiliation note. Keep or cut
- Venues page: "you can change or remove it at any time" and "through the communities we run"

## Photo credits

All from Unsplash, under the Unsplash Licence (free for commercial use; credit is not required but we give it).

- team-code (home): Flipsnack, "Two men sitting in front of a laptop computer" (unsplash.com/photos/Hp4RPL_Z6wE)
- table (home): Jaykumar Bherwani, "Students studying together at a long table" (unsplash.com/photos/Dg8WzlOE1as)
- robot-arm (home, Robotics): ZHENYU LUO, "White robotic arm in display showroom" (unsplash.com/photos/kE0JmtbvXxM)
- launch (home, Space tech): SpaceX, "Rocket launch light trail at dusk" (unsplash.com/photos/-p-KCm6xB9I)
- solar (home, Energy): American Public Power Association, "Solar panels on green field" (unsplash.com/photos/513dBrMJ_5w)
- robot-lab (universities): Testalize.me, "Industrial robotic arm in blue lit factory" (unsplash.com/photos/9xHsWmh3m_4)
- hackathon (companies): Alex Kotliarskyi, "People doing office works" (unsplash.com/photos/QBpZGqEMsKg)
- pitch (investors): Teemu Paananen, "Person discussing while standing in front of a large screen" (unsplash.com/photos/bzdhc5b3Bxs)
- small-room (network): Product School, "People sitting and using laptops" (unsplash.com/photos/XZkk5xT8Xrk)

## Naming

"BQ Fellow" and "The BQ Brief" are used instead of "Quorum Fellow" and "Quorum Brief" until trademark clearance. Always write the brand as "Builders’ Quorum" or "BQ", never "Quorum" alone.

Research behind the student material (now on the universities page) and the student questions in the form is in `../research/student-demand.md`. The survey draft is in `../survey/bq-survey.md`.
