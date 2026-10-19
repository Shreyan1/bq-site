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
apply.html        "Work with us", a short letter in numbered parts, each on its own soft panel. Four main ways in (university,
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
assets/fonts/     self-hosted woff2 files (Latin only) with their OFL licences, declared at the top of styles.css.
                  The source zip may sit here locally; it is git-ignored
src/land.json     the world's land as a grid of dots for the hero map (about 12,800 dots, 7 KB). Rebuild
                  with `npm run land` (tools/build_land.mjs: Natural Earth 1:50m via world-atlas, Miller
                  projection, spherical land test with d3-geo; takes about two minutes)
assets/photos/    nine photographs at 1000 and 2000 px wide, WebP. Credits below
assets/photos/builders/
                  twelve black-and-white portraits for the builders reel on the home page, WebP, all cropped
                  to 4:5 with the head in frame, 800 x 1000 px. Sources and licences below. source/ holds the originals locally and is git-ignored
assets/          logo.svg (icon in header and footer), favicon.svg, apple-touch-icon.png. Copied from ../logo
favicon.ico       16, 32 and 48 px, also from ../logo
404.html, robots.txt, sitemap.xml
tools/            build_venues.py (generates venues.html), build_land.mjs (hero map), check_site.py (checks, see below)
```

The header, footer and pencil filter are repeated on every page. If you change one, change all eight. 404.html uses root-relative links (`/network.html`) so it works at any path.

## Preview locally

```bash
python3 -m http.server 8000 --directory website
```

Then open http://localhost:8000.

## Checks

```bash
python3 tools/check_site.py          # from website/; Python standard library only
```

It exits 1 if anything fails and prints `file:line [check] message`. It covers CSS class collisions (a bare selector such as `.step` that styles unrelated components on different pages), local links, anchors and ids, image alt, width and height against the real file size, portrait credits against this README, fonts, head tags, JSON-LD, whether `venues.html` is stale against its generator, and the CLAUDE.md writing rules (em dashes, brand spelling, Oxford comma, US spelling, Indian place names outside the footer). `FAIL` must be fixed, `WARN` needs a look, `NOTE` is information, and `KNOWN` is a failure the founders have been told about, listed with its reason in `KNOWN` at the top of the script. By default `NOTE` lines are only counted and `KNOWN` ones are grouped; `--verbose` lists every one of them, `--collisions` also lists every shared class, `--quiet` hides warnings and `--root PATH` checks another copy of the site. It runs from any folder. Run it before every push; it takes under a second. It does not render anything, so layout, overflow and contrast still need a look in the browser at 1440 px and 375 px.

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
- Colour: ink on warm paper (#FBFAF7) with a faint grain, one accent used sparingly. The header and the footer are the dark areas that frame every page, and everything between them stays light, except the builders reel on the home page, which plays on ink like a film. The `.section-ink` style is still in the stylesheet but no page uses it. In the wordmark (header, footer and the large closing mark) the apostrophe and the full stop are always the accent colour: `Builders<span class="accent">’</span> Quorum<span class="accent">.</span>`. Running text spells the name plainly.
- Shape and layout: soft corners. Cards, panels and portraits are rounded (16px; 20px for the panels of the form), buttons and tags are pills, and hairlines still separate rows and sections. Buttons and labels use small tracked capitals. On hover a button's fill rises from its bottom edge, and the arrow on a primary button sits in its own disc and turns towards where it leads. The sector grid (home and network) uses the same idea: an ink fill grows from where the pointer enters. FAQ questions are set in the serif, with the + in a disc that fills on hover. Hover feedback starts within about a quarter of a second everywhere; slow, calm motion is for scroll reveals, not for answering the pointer. On wide screens each section has a sticky left column with its number (01, 02...) and label, and the content sits on the right. The home page has a ticker of sectors and formats, a large statement that lights up word by word as you scroll, and every page ends with a large wordmark.
- Spacing: section padding tops out at 7rem, and the sticky left column starts at 56rem (896px). The closing call-to-action band splits into heading left and text and buttons right from the same width, so no block leaves half the width empty.
- The style sheet is layered: base styles first, then "Layout v2", then the "Refinement pass", which overrides earlier rules. When changing a component, check the refinement pass first.
- Pencil sketches: inline SVG strokes in graphite, with one accent element each. A shared `#pencil` filter roughens the lines. Each stroke has `pathLength="1"`, so CSS can draw it in. To add a sketch, give it `class="sketch"`, put the strokes inside a `<g>`, and give every stroke `pathLength="1"`.
- Living sketches: once drawn, parts keep moving. The rocket bobs and its flame flickers, the pencil writes, the flag waves, the seedling sways and sticky notes wiggle. Dots travel along paths (SMIL `animateMotion`, made by `mover()`), and hero sketches "boil" by swapping between three pencil filters. Moving parts are nested `<g>` groups with classes like `bob`, `sway` or `wave`.
- Hero map (home only): the world's land drawn as ink dots, each one a person, across the full width of the hero (faint behind the text, full on the right). The map is flat and in true proportion (Miller projection, 84°N to 56°S), so continents keep the shapes people know; don't tilt or stretch it. Every couple of seconds someone is found: circled in pencil, labelled with the industry that found them, and linked to the nearest earlier find by an arc. Only the newest circle is in the accent. Near the pointer people come into focus and gather in, the camera shifts with it, a faint circle offers the nearest person and clicking (or tapping) finds them. The scene loads after the page is idle (about 130 KB gzipped), pauses off screen and in background tabs, shows one finished cohort for reduced motion, and is removed for data saver or when WebGL fails. On narrow screens it is a figure below the buttons. Tune it in `src/field.js`, then `npm run build`.
- Photographs: warm black and white (grayscale with a little sepia). The four audience pages (universities, enterprises, investors, network) open on their photograph, beside the headline on wide screens and under the buttons on phones, in place of a pencil sketch, so the first screen has a real scene in it. Long pages are broken up with full-width photograph bands (`<figure class="photo photo-band">`), each chosen for what the section above it says and used only once on the site: a mentor with a mixed pod after the universities programme, a London skyline with cranes after the sectors (real estate and the City), a university lecture hall before the formats borrowed from leading universities, a conference audience on enterprises (flagship events), a small team pitching on investors and a researcher at a chalkboard of equations on the network page. No band shows a logo, a flag or a recognisable public figure. Replace them with BQ's own photographs when there are some. The home page has a pair of photographs and three captioned sectors (robotics, space tech, energy) under the frontiers grid. Each one shows what its page is about: students building on the home page, a hackathon for companies, a pitch for investors, a small technical session for the network. Avoid stock that only signals "technology" (chips, circuit boards), and avoid close-up faces and visible brands. They open upwards as they arrive. They are atmosphere, so `alt` is empty, and none of them is presented as BQ's own people or events. Replace them with photographs from real BQ chapters and sessions when there are some.
- Global first: nothing outside the footer says where BQ is based. Language tags are en-GB and spelling is British.
- Accent discipline: vermilion means "chosen". It marks the newest find in the home hero, the BQ Fellow step, the one key stroke in each sketch, the brand mark and the current page in the nav. Sub-heading underlines, callouts, note bullets, FAQ toggles, section markers and tags are ink. Keep it that way when adding sections.
- Speed: fonts are self-hosted and the two above the fold are preloaded, so no request leaves the site before text renders. The paper grain carries its own alpha instead of using `mix-blend-mode`, which made every scroll frame repaint the whole page.
- Motion: on page load the headline rises in and the underline under "founders" draws. Sketches draw stroke by stroke as they scroll into view. Reveals are triggered by scroll position, not IntersectionObserver, so anything already scrolled past is shown at once and fast scrolling never leaves gaps. Other content fades up as you scroll, and there is a reading-progress line under the header. Pages cross-fade in browsers that support view transitions. The builders reel on the home page never holds the page: it scrolls like any section. Its opening lines come out of a blur one by one as you scroll (and blur again if you scroll back), then a film strip of the twelve builders drifts to the left and loops, fading in and out at the edges. It can be dragged or swiped, scrolled sideways on a trackpad or moved with the arrow keys, and it keeps the momentum it is given before settling back to its drift; portraits lean a little into fast motion. Speed eases rather than jumps, so pressing Pause brings it to a soft stop, and scrolling the page gives it a push. It only runs while on screen and goes idle once stopped. With reduced motion or without JS the strip stands still and scrolls sideways. All motion switches off for `prefers-reduced-motion`, and content stays visible without JS.
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
- mentor-pod (universities band): Vitaly Gariev, "Diverse team collaborating on a project in an office" (unsplash.com/photos/PSksbOVDhWk)
- london-cranes (universities band): MChe Lee, "London skyline with construction cranes" (unsplash.com/photos/EXLnFP4p3Vg)
- lecture-hall (universities band): Austin, "A group of people sitting in front of a blackboard" (unsplash.com/photos/N8Z8s3n3qBk)
- conference (enterprises band): Headway, "Crowd of people sitting on chairs inside room" (unsplash.com/photos/F2KRf_QfCqw)
- team-pitch (investors band): Austin Distel, "Three men sitting while using laptops and watching man beside whiteboard" (unsplash.com/photos/wD1LRb9OeEo)
- chalkboard (network band): Vitaly Gariev, "Woman writing complex formulas on a chalkboard wall" (unsplash.com/photos/4wSQmHIlD0Q)

Builders reel portraits (`assets/photos/builders/`), all from Wikimedia Commons, cropped to 4:5 and converted to black and white. The reel shows founders whose brands the world still knows and whose start was hard, because that is what BQ helps students do. Keep it to founders who clearly made it, and let each caption carry the struggle in a few words (every fact is from the person's Wikipedia article). All twelve photographs are in the public domain, so the page carries no credit line. Don't add one under a Creative Commons licence unless the page also credits it: the check script fails if one is missing.

- jamsetji-tata: Andhra Patrika annual, 1911, public domain (commons.wikimedia.org/wiki/File:Jamshedji_Nusserwanji_Tata_from_Andhrapatrika_samvatsaradi_sanchika_1911_(page_197_crop).jpg)
- bertha-benz: Bühler, Mannheim, around 1871, Automuseum Dr. Carl Benz, public domain (commons.wikimedia.org/wiki/File:Berthabenzportrait.jpg)
- george-eastman: Paul Nadar, 1890, Smithsonian National Portrait Gallery, public domain (commons.wikimedia.org/wiki/File:George_Eastman_founder_of_Eastman_Kodak_Company.jpg)
- thomas-lipton: Bolles, 1903, Library of Congress, public domain (commons.wikimedia.org/wiki/File:Thomas_Lipton_cph.3a43970.jpg)
- milton-hershey: around 1905, Hershey Community Archives, public domain (commons.wikimedia.org/wiki/File:Milton_S._Hershey_c1905.jpg)
- elizabeth-arden: Alan Fisher, New York World-Telegram and the Sun, 1939, Library of Congress, public domain (commons.wikimedia.org/wiki/File:Elizabeth_Arden_NYWTS.jpg)
- walt-disney: NASA, 1954, public domain (commons.wikimedia.org/wiki/File:Walt_disney_portrait_right.jpg)
- hewlett-packard: Daily Palo Alto Times, 17 February 1960, public domain (commons.wikimedia.org/wiki/File:William_Hewlett_and_David_Packard_1960.jpg)
- estee-lauder: Bill Sauro, New York World-Telegram and the Sun, 1966, Library of Congress, public domain (commons.wikimedia.org/wiki/File:Estee_Lauder_NYWTS.jpg)
- steve-jobs: Bernard Gotfryd, January 1984, Library of Congress (gtfy.01855), public domain (commons.wikimedia.org/wiki/File:Steve_Jobs_and_Macintosh_computer,_January_1984,_by_Bernard_Gotfryd_-_edited.jpg)
- oprah-winfrey: Lawrence Jackson, official White House photograph, 20 November 2013, public domain; cropped so only she is in frame (commons.wikimedia.org/wiki/File:Oprah_Winfrey_receives_2013_Presidential_Medal_of_Freedom.jpg)
- morris-chang: MIT Technique yearbook, 1951, public domain (commons.wikimedia.org/wiki/File:Morris_Chang_1951_MIT_yearbook_portrait.jpg)

Rejected while choosing, so they are not tried again: Commons tags some photographs as public domain on weak grounds. The 1946 G. D. Birla photographs are LIFE pictures by Margaret Bourke-White; the 1914 Harland Sanders photograph was first published by KFC around 2014; the young William Boeing photograph's only source is Pinterest; Ruth Handler's photographs are CC BY 4.0; the 1955 J. R. D. Tata photograph is an Indian government picture whose US status is unclear. The portraits are shown as examples of founders, with a caption saying what each built. Oprah Winfrey and Morris Chang are alive; if either objects, remove the portrait.

## Naming

"BQ Fellow" and "The BQ Brief" are used instead of "Quorum Fellow" and "Quorum Brief" until trademark clearance. Always write the brand as "Builders’ Quorum" or "BQ", never "Quorum" alone.

Research behind the student material (now on the universities page) and the student questions in the form is in `../research/student-demand.md`. The survey draft is in `../survey/bq-survey.md`.
