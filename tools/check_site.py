#!/usr/bin/env python3
"""Static checks for the Builders' Quorum site. Standard library only.

Run from website/:   python3 tools/check_site.py
Options:             --root PATH   check another copy of the site (for example an older commit)
                     --quiet       print failures and known issues only (no warnings)
                     --verbose     also list every NOTE and every KNOWN occurrence
                     --collisions  also list every class shared between components

Exit status is 1 when any check fails. Each line is file:line followed by the check name.
FAIL stops the build, WARN needs a human look, KNOWN is a failure the founders have been told about
and that is listed in KNOWN below with the reason (it does not change the exit status).

What it checks
  collisions  bare single-class selectors in styles.css whose class is used by unrelated components
  links       local href, src, srcset, url() and in-page anchors resolve; ids are unique
  images      alt, width and height on every img, matching the real pixel size (WebP, PNG, JPEG)
  credits     builders portraits are in README.md with a source and licence; CC ones are credited on the page
  fonts       preloads and @font-face files exist; no removed fonts
  generated   venues.html equals the output of tools/build_venues.py
  head        title, description, canonical, og:url, lang, one h1 per page
  writing     CLAUDE.md rules on visible text (em dashes, brand spelling, Oxford comma, US spelling,
              Indian place names outside the footer); fragments and "X, not Y" are warnings
"""

import argparse
import json
import re
import shutil
import struct
import subprocess
import sys
import tempfile
from collections import defaultdict
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse

# ---------------------------------------------------------------------------
# Settings

SITE = 'https://buildersquorum.com/'
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}
INLINE = {'a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'data', 'dfn', 'em', 'i', 'kbd', 'mark', 'q', 's', 'samp',
          'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'tspan'}
SKIP_TEXT = {'script', 'style', 'title'}
REMOVED_FONTS = re.compile(r'instrument[ -_]?serif|inter[ -_]?tight|urbanist-800', re.I)

# Classes that every component shares on purpose; they never count as a component of their own.
GENERIC_PARENTS = {'wrap', 'section', 'section-wash', 'section-ink', 'grid', 'stack', 'split'}

# (check, file) -> reason. Failures listed here are printed as KNOWN and do not fail the run.
KNOWN = {
    ('writing-places', 'apply.html'):
        'The organiser and venue options on the form list Delhi NCR areas for the venues page (same decision as venues.html).',
    ('writing-places', 'venues.html'):
        'venues.html is about Delhi NCR by design (7 October decision) but the 11 October "global first" rule '
        'says nothing outside the footer names Indian places. Founders to decide: keep, or make the page '
        'region-neutral.',
}

PLACES = re.compile(
    r'\b(India|Indian|Delhi|NCR|Gurugram|Gurgaon|Noida|Faridabad|Ghaziabad|Haryana|Uttar Pradesh|Bengaluru|Bangalore|'
    r'Mumbai|Hyderabad|Pune|Jaipur|Chennai|Kolkata|Chandigarh|E-cells?|IITs?|IIMs?|lakhs?|crores?|MeitY|NASSCOM)\b|₹|\bRs\.? ?\d')
US_SPELLING = [
    (re.compile(r'\b(?!(?:size|sized|sizes|sizing|prize|prizes|seize|seized|capsize|resize|resized|baize)\b)'
                r'[A-Za-z]{3,}iz(?:e|es|ed|ing|ation|ations)\b', re.I), '-ize/-ization (use -ise/-isation)'),
    (re.compile(r'\b(colors?|colored|behaviors?|favorites?|honors?|labor|neighbors?|analy[sz]e|catalog|defense|gray|'
                r'traveling|modeling|canceled|fulfill|centers?|centered|programs?)\b', re.I), 'US spelling'),
]
AI_WORDS = re.compile(r"\b(delve|delves|leverage|leverages|leveraging|unlock|unlocks|unlocking|seamless|"
                      r"fast-paced|game-changer|tapestry)\b", re.I)

# ---------------------------------------------------------------------------
# Reporting


class Report:
    def __init__(self):
        self.items = []  # (level, file, line, check, message)

    def add(self, level, file, line, check, msg):
        if level == 'FAIL' and (check, file) in KNOWN:
            self.items.append(('KNOWN', file, line, check, msg))
        else:
            self.items.append((level, file, line, check, msg))

    def fail(self, file, line, check, msg):
        self.add('FAIL', file, line, check, msg)

    def warn(self, file, line, check, msg):
        self.add('WARN', file, line, check, msg)

    def note(self, file, line, check, msg):
        self.add('NOTE', file, line, check, msg)

    def print(self, quiet=False, verbose=False):
        order = ['FAIL', 'KNOWN', 'WARN', 'NOTE']
        items = sorted(self.items, key=lambda i: (order.index(i[0]), i[1], i[2]))
        known = defaultdict(list)
        for level, file, line, check, msg in items:
            if level == 'KNOWN':
                known[(file, check)].append(line)
            elif level == 'FAIL' or (level == 'WARN' and not quiet) or (level == 'NOTE' and verbose):
                print(f'{level:5} {file}:{line}  [{check}] {msg}')
        for (file, check), lines in known.items():
            if verbose:
                for ln in lines:
                    print(f'KNOWN {file}:{ln}  [{check}]')
            else:
                print(f'KNOWN {file}:{lines[0]}  [{check}] {len(lines)} occurrences, first shown (--verbose lists all)')
        for level in order:
            n = sum(1 for i in self.items if i[0] == level)
            print(f'{level.lower():>5}: {n}' + (' (use --verbose to list)' if level == 'NOTE' and n and not verbose else ''))
        for (c, f), r in KNOWN.items():
            if (f, c) in known:
                print(f'known issue {f} [{c}]: {r}')

    @property
    def failed(self):
        return any(i[0] == 'FAIL' for i in self.items)


# ---------------------------------------------------------------------------
# HTML parsing


class El:
    __slots__ = ('tag', 'attrs', 'line', 'parent', 'children', 'classes', 'text', 'text_line')

    def __init__(self, tag, attrs, line, parent):
        self.tag, self.attrs, self.line, self.parent = tag, attrs, line, parent
        self.children = []
        self.classes = (attrs.get('class') or '').split()
        self.text = []
        self.text_line = line

    def ancestors(self):
        p = self.parent
        while p:
            yield p
            p = p.parent

    def in_footer(self):
        return any(a.tag == 'footer' or 'site-footer' in a.classes for a in [self, *self.ancestors()])


class Page(HTMLParser):
    def __init__(self, path, rel):
        super().__init__(convert_charrefs=True)
        self.rel = rel
        self.root = El('#root', {}, 1, None)
        self.cur = self.root
        self.elements = []
        self.blocks = []  # (element, text, line)
        self.attr_text = []  # (line, text, in_footer, label)
        self.skip = 0
        self.title = ''
        self.ldjson = []
        self.in_ld = False
        self.feed(path.read_text(encoding='utf-8'))
        self.close()

    def handle_starttag(self, tag, attrs):
        a = {k: (v if v is not None else '') for k, v in attrs}
        line = self.getpos()[0]
        el = El(tag, a, line, self.cur)
        self.cur.children.append(el)
        self.elements.append(el)
        for k in ('alt', 'title', 'aria-label', 'placeholder'):
            if a.get(k):
                self.attr_text.append((line, a[k], el.in_footer(), f'{tag}[{k}]'))
        if tag == 'meta' and a.get('content') and (a.get('name') in ('description',) or a.get('property') in ('og:title', 'og:description')):
            self.attr_text.append((line, a['content'], False, f'meta {a.get("name") or a.get("property")}'))
        if tag in SKIP_TEXT:
            self.skip += 1
            self.in_ld = tag == 'script' and a.get('type') == 'application/ld+json'
        if tag not in VOID:
            self.cur = el
        elif tag in SKIP_TEXT:
            self.skip -= 1

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        el = self.cur
        while el and el.tag != tag:
            el = el.parent
        if not el or el is self.root:
            return
        if tag in SKIP_TEXT:
            self.skip -= 1
            self.in_ld = False
        self.cur = el.parent

    def handle_data(self, data):
        if self.in_ld:
            self.ldjson.append(data)
        if self.cur.tag == 'title':
            self.title += data
        if self.skip or not data.strip():
            return
        el = self.cur
        block = el
        while block.tag in INLINE and block.parent:
            block = block.parent
        if not block.text:
            block.text_line = self.getpos()[0]
        block.text.append(data)
        self.blocks.append(block) if block not in self.blocks[-1:] else None

    def block_texts(self):
        seen = set()
        for b in self.blocks:
            if id(b) in seen:
                continue
            seen.add(id(b))
            text = re.sub(r'\s+', ' ', ''.join(b.text)).strip()
            if text:
                yield b, text, b.text_line


def meta(page, **want):
    for el in page.elements:
        if el.tag in ('meta', 'link') and all(el.attrs.get(k) == v for k, v in want.items()):
            return el
    return None


# ---------------------------------------------------------------------------
# Image sizes


def image_size(path):
    d = path.read_bytes()
    ext = path.suffix.lower()
    if ext == '.webp' and d[:4] == b'RIFF' and d[8:12] == b'WEBP':
        kind = d[12:16]
        if kind == b'VP8X':
            return 1 + int.from_bytes(d[24:27], 'little'), 1 + int.from_bytes(d[27:30], 'little')
        if kind == b'VP8L':
            bits = int.from_bytes(d[21:25], 'little')
            return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
        if kind == b'VP8 ':
            w, h = struct.unpack('<HH', d[26:30])
            return w & 0x3FFF, h & 0x3FFF
    if ext == '.png' and d[:8] == b'\x89PNG\r\n\x1a\n':
        return struct.unpack('>II', d[16:24])
    if ext in ('.jpg', '.jpeg') and d[:2] == b'\xff\xd8':
        i = 2
        while i < len(d) - 9:
            if d[i] != 0xFF:
                i += 1
                continue
            marker = d[i + 1]
            if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
                i += 2
                continue
            length = struct.unpack('>H', d[i + 2:i + 4])[0]
            if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
                h, w = struct.unpack('>HH', d[i + 5:i + 9])
                return w, h
            i += 2 + length
    if ext == '.svg':
        m = re.search(r'viewBox="[\d.\-]+[ ,]+[\d.\-]+[ ,]+([\d.]+)[ ,]+([\d.]+)"', d.decode('utf-8', 'ignore'))
        if m:
            return float(m.group(1)), float(m.group(2))
    return None


# ---------------------------------------------------------------------------
# CSS parsing


def strip_comments(css):
    return re.sub(r'/\*.*?\*/', lambda m: re.sub(r'[^\n]', ' ', m.group(0)), css, flags=re.S)


def scan_to(text, i, stops):
    """Index of the first character in stops at depth 0 (outside strings and parentheses), or -1."""
    depth = 0
    quote = None
    while i < len(text):
        c = text[i]
        if quote:
            if c == '\\':
                i += 1
            elif c == quote:
                quote = None
        elif c in '"\'':
            quote = c
        elif c == '(':
            depth += 1
        elif c == ')':
            depth -= 1
        elif depth == 0 and c in stops:
            return i
        i += 1
    return -1


def match_brace(text, i):
    depth = 0
    quote = None
    while i < len(text):
        c = text[i]
        if quote:
            if c == '\\':
                i += 1
            elif c == quote:
                quote = None
        elif c in '"\'':
            quote = c
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return len(text) - 1


def split_top(s, sep):
    out, depth, cur, quote = [], 0, '', None
    for c in s:
        if quote:
            cur += c
            if c == quote:
                quote = None
            continue
        if c in '"\'':
            quote = c
        if c in '([':
            depth += 1
        elif c in ')]':
            depth -= 1
        if c == sep and depth == 0:
            out.append(cur)
            cur = ''
        else:
            cur += c
    out.append(cur)
    return out


class Rule:
    __slots__ = ('selector', 'props', 'line', 'media')

    def __init__(self, selector, props, line, media):
        self.selector, self.props, self.line, self.media = selector, props, line, media


def parse_css(text):
    """Return (rules, font_faces). Rules inside @media and @supports are flattened with their condition kept."""
    text = strip_comments(text)
    rules, faces = [], []

    def walk(lo, hi, media):
        i = lo
        while i < hi:
            j = scan_to(text, i, '{;')
            if j == -1 or j >= hi:
                break
            prelude = text[i:j].strip()
            line = text.count('\n', 0, i + (len(text[i:j]) - len(text[i:j].lstrip()))) + 1
            if text[j] == ';':
                i = j + 1
                continue
            end = match_brace(text, j)
            body = text[j + 1:end]
            if prelude.startswith('@'):
                name = re.match(r'@([\w-]+)', prelude).group(1)
                if name in ('media', 'supports', 'layer', 'container'):
                    walk(j + 1, end, media + [prelude])
                elif name == 'font-face':
                    faces.append((line, body))
            else:
                props = {}
                for decl in split_top(body, ';'):
                    if ':' in decl:
                        k, v = decl.split(':', 1)
                        props[k.strip().lower()] = ' '.join(v.split())
                for sel in split_top(prelude, ','):
                    sel = ' '.join(sel.split())
                    if sel:
                        rules.append(Rule(sel, props, line, tuple(media)))
            i = end + 1

    walk(0, len(text), [])
    return rules, faces


def compounds(selector):
    """Split a selector into compounds on combinators outside brackets and parentheses."""
    parts, cur, depth = [], '', 0
    for c in selector:
        if c in '([':
            depth += 1
        elif c in ')]':
            depth -= 1
        if depth == 0 and c in ' >+~':
            if cur:
                parts.append(cur)
            cur = ''
        else:
            cur += c
    if cur:
        parts.append(cur)
    return parts


BARE = re.compile(r'\.([\w-]+)(?::{1,2}[\w-]+(?:\([^)]*\))?|\[[^\]]*\])*')
VISUAL = ('background', 'border', 'box-shadow', 'padding', 'width', 'height', 'min-height', 'min-width', 'position',
          'display', 'border-radius', 'outline', 'content', 'margin', 'transform', 'overflow', 'grid-template-columns')


def bare_class(selector):
    parts = compounds(selector)
    if len(parts) == 1:
        m = BARE.fullmatch(parts[0])
        if m:
            return m.group(1), parts[0][len(m.group(1)) + 1:]
    return None


def subject_classes(selector):
    parts = compounds(selector)
    if not parts:
        return [], 0
    subj = re.sub(r'\([^)]*\)', '', parts[-1])
    return re.findall(r'\.([\w-]+)', subj), len(parts)


# ---------------------------------------------------------------------------
# Checks


PAINT = re.compile(r'^(background|border|box-shadow|padding|outline|width|height|min-|max-|position|border-radius|content|'
                   r'counter-|grid-template|inset|top|left|right|bottom|overflow)')


def is_paint(prop, value):
    return bool(PAINT.match(prop)) or (prop == 'display' and value not in ('inline', 'inline-block', 'block', 'contents'))


def check_collisions(rep, pages, rules, css_name, show_all=False):
    """A bare single-class selector styles every element with that class, on every page.

    It is a bug waiting to happen when unrelated components share the class name: a leaf (a number in a span)
    and a container (a fieldset full of inputs), say. Such a class is FAIL when the bare rule paints (background,
    border, padding, size, display) and WARN when it only sets type. Classes used in several places with rules that
    set the same property twice are NOTE, and `--collisions` lists them all.
    """
    bare = defaultdict(list)    # class -> [rule]
    scoped = defaultdict(list)  # class -> [rule] (qualified selectors such as ".form .step")
    for r in rules:
        b = bare_class(r.selector)
        if b and not b[1].startswith('::'):
            bare[b[0]].append(r)
        classes, n = subject_classes(r.selector)
        for c in classes:
            if not b or b[0] != c:
                scoped[c].append(r)

    usage = defaultdict(lambda: defaultdict(list))  # class -> (tag, kind, parent component) -> [(page, line)]
    for rel, page in pages.items():
        for el in page.elements:
            kind = 'box' if any(c.tag not in INLINE for c in el.children) else 'leaf'
            parent = '-'
            for a in el.ancestors():
                own = [x for x in a.classes if x not in GENERIC_PARENTS]
                if own:
                    parent = f'{a.tag}.{own[0]}'
                    break
            for c in el.classes:
                usage[c][(el.tag, kind, parent)].append((rel, el.line))

    for c, brules in sorted(bare.items()):
        ctx = usage.get(c, {})
        if not ctx:
            continue
        tags = {k[0] for k in ctx}
        kinds = {k[1] for k in ctx}
        parents = {k[2] for k in ctx}
        pages_used = {u[0] for v in ctx.values() for u in v}
        bare_props = {}
        for r in brules:
            if not r.media:
                bare_props.update(r.props)
        paint = sorted(p for p, v in bare_props.items() if is_paint(p, v))
        quals = [r for r in scoped.get(c, []) if len(compounds(r.selector)) > 1 and not r.media]
        conflicts = sorted({p for r in quals for p in r.props if p in bare_props})
        leaf_inline = any(k[0] in INLINE and k[1] == 'leaf' for k in ctx)
        box_block = any(k[0] not in INLINE and k[1] == 'box' for k in ctx)
        unrelated = leaf_inline and box_block
        if not (unrelated or conflicts or (len(tags) > 1) or (show_all and (len(parents) > 1 or len(pages_used) > 1))):
            continue
        where = ', '.join(f'<{t}{"*" if k == "box" else ""}> in {p} x{len(v)}' for (t, k, p), v in sorted(ctx.items()))
        line = brules[0].line
        detail = (f'.{c} is a bare selector used by {where}'
                  + (f'; the bare rule sets {paint}' if paint else '; the bare rule only sets type')
                  + (f'; also styled by {sorted({r.selector for r in quals})[:3]}' if quals else '')
                  + (f'; both set {conflicts}' if conflicts else ''))
        if unrelated:
            (rep.fail if paint else rep.warn)(css_name, line, 'collision', detail + ' (a leaf and a container share the class: scope the bare rule)')
        elif conflicts or len(tags) > 1:
            rep.note(css_name, line, 'collision', detail)
        else:
            rep.note(css_name, line, 'collision', detail)


def local_target(root, base, ref):
    """Map a local reference to a path under root, or None for external references."""
    ref = ref.strip()
    if not ref or ref.startswith(('#', 'mailto:', 'tel:', 'data:', 'javascript:', 'sms:')):
        return None
    u = urlparse(ref)
    if u.scheme or u.netloc:
        return None
    p = unquote(u.path)
    path = (root / p.lstrip('/')) if p.startswith('/') else (base.parent / p)
    return path.resolve()


def check_links(rep, root, pages):
    ids_by_page = {rel: {} for rel in pages}
    for rel, page in pages.items():
        for el in page.elements:
            i = el.attrs.get('id')
            if i:
                if i in ids_by_page[rel]:
                    rep.fail(rel, el.line, 'ids', f'duplicate id "{i}" (first at line {ids_by_page[rel][i]})')
                ids_by_page[rel].setdefault(i, el.line)

    def exists(path):
        return path is not None and path.exists()

    for rel, page in pages.items():
        base = root / rel
        for el in page.elements:
            refs = []
            for k in ('href', 'src', 'poster', 'data-src'):
                if el.attrs.get(k):
                    refs.append((k, el.attrs[k]))
            for k in ('srcset', 'imagesrcset'):
                if el.attrs.get(k):
                    for cand in el.attrs[k].split(','):
                        if cand.strip():
                            refs.append((k, cand.strip().split()[0]))
            if el.attrs.get('style'):
                for u in re.findall(r'url\(\s*["\']?([^"\')]+)', el.attrs['style']):
                    refs.append(('style url()', u))
            for k, ref in refs:
                if el.tag == 'a' and k == 'href' and ref.startswith('#'):
                    if ref[1:] and ref[1:] not in ids_by_page[rel]:
                        rep.fail(rel, el.line, 'links', f'anchor {ref} has no matching id')
                    continue
                target = local_target(root, base, ref)
                if target is None:
                    continue
                if not exists(target):
                    rep.fail(rel, el.line, 'links', f'{k} "{ref}" does not exist')
                    continue
                frag = urlparse(ref).fragment
                if frag and target.suffix == '.html':
                    trel = str(target.relative_to(root))
                    if trel in ids_by_page and frag not in ids_by_page[trel]:
                        rep.fail(rel, el.line, 'links', f'{k} "{ref}": no id "{frag}" in {trel}')
            for k in ('aria-controls', 'aria-labelledby', 'aria-describedby', 'for'):
                for i in (el.attrs.get(k) or '').split():
                    if i not in ids_by_page[rel]:
                        rep.fail(rel, el.line, 'ids', f'{k}="{i}" has no matching id on this page')


def check_css_urls(rep, root, css_path, css_text):
    text = strip_comments(css_text)
    text = re.sub(r'url\(\s*(["\'])data:.*?\1\s*\)', lambda m: re.sub(r'[^\n]', ' ', m.group(0)), text)
    for m in re.finditer(r'url\(\s*(["\']?)([^)"\']+)\1\s*\)', text):
        ref = m.group(2)
        if ref.startswith(('#', '%23')):
            continue
        line = text.count('\n', 0, m.start()) + 1
        target = local_target(root, css_path, ref)
        if target is not None and not target.exists():
            rep.fail(css_path.name, line, 'links', f'url({ref}) does not exist')


def check_js_paths(rep, root, js_path):
    text = js_path.read_text()
    for m in re.finditer(r'["\'`]((?:\./)?assets/[\w./-]+)["\'`]', text):
        if not (root / m.group(1)).exists():
            rep.fail(js_path.name, text.count('\n', 0, m.start()) + 1, 'links', f'"{m.group(1)}" does not exist')


def check_images(rep, root, pages):
    for rel, page in pages.items():
        for el in page.elements:
            if el.tag != 'img':
                continue
            a = el.attrs
            if 'alt' not in a:
                rep.fail(rel, el.line, 'images', f'img {a.get("src")} has no alt attribute')
            for k in ('width', 'height'):
                if not a.get(k, '').isdigit():
                    rep.fail(rel, el.line, 'images', f'img {a.get("src")} needs a numeric {k}')
            src = a.get('src', '')
            target = local_target(root, root / rel, src)
            if target is None or not target.exists():
                continue
            size = image_size(target)
            if size is None:
                rep.warn(rel, el.line, 'images', f'cannot read the size of {src}')
                continue
            if a.get('width', '').isdigit() and a.get('height', '').isdigit():
                w, h = int(a['width']), int(a['height'])
                if target.suffix == '.svg':
                    if abs(w / h - size[0] / size[1]) > 0.02:
                        rep.fail(rel, el.line, 'images', f'{src} viewBox is {size[0]:g}x{size[1]:g} but img is {w}x{h}')
                elif (w, h) != tuple(size):
                    rep.fail(rel, el.line, 'images', f'{src} is {size[0]}x{size[1]} px but the img says {w}x{h}')
            if a.get('srcset'):
                for cand in a['srcset'].split(','):
                    bits = cand.split()
                    if len(bits) != 2:
                        continue
                    t = local_target(root, root / rel, bits[0])
                    if t is None or not t.exists():
                        continue
                    s = image_size(t)
                    if s and bits[1].endswith('w') and bits[1][:-1].isdigit() and s[0] != int(bits[1][:-1]):
                        rep.fail(rel, el.line, 'images', f'srcset says {bits[0]} is {bits[1]} but it is {s[0]} px wide')
                    if s and size and abs(s[0] / s[1] - size[0] / size[1]) > 0.01:
                        rep.fail(rel, el.line, 'images', f'srcset image {bits[0]} has a different aspect ratio from {src}')


def check_credits(rep, root, pages):
    readme = (root / 'README.md').read_text()
    folder = root / 'assets/photos/builders'
    if not folder.exists():
        return
    entries = {}
    for i, line in enumerate(readme.splitlines(), 1):
        m = re.match(r'- ([\w-]+): (.*)', line)
        if m:
            entries[m.group(1)] = (i, m.group(2))
    shown = defaultdict(set)
    for rel, page in pages.items():
        for el in page.elements:
            if el.tag == 'img' and 'photos/builders/' in el.attrs.get('src', ''):
                shown[Path(el.attrs['src']).stem].add(rel)
    texts = {rel: ' '.join(t for _, t, _ in page.block_texts()) for rel, page in pages.items()}
    for img in sorted(folder.glob('*.webp')):
        stem = img.stem
        rel = f'assets/photos/builders/{img.name}'
        if stem not in entries:
            rep.fail('README.md', 1, 'credits', f'{rel} has no source and licence entry in README.md')
            continue
        line, text = entries[stem]
        lic = re.search(r'public domain|CC BY(?:-SA)? \d\.\d', text)
        if not lic or 'commons.wikimedia.org' not in text:
            rep.fail('README.md', line, 'credits', f'{stem}: entry needs a licence (public domain or CC) and a source URL')
            continue
        if not shown.get(stem):
            rep.warn('README.md', line, 'credits', f'{stem} is in the README but no page shows it')
        if lic.group(0).startswith('CC'):
            name = stem.replace('-', ' ').title()
            for p in shown.get(stem, ()):
                t = texts[p]
                if lic.group(0) not in t or name not in t:
                    rep.fail(p, 1, 'credits', f'{stem} is {lic.group(0)} but {p} does not credit "{name}" with that licence in visible text')
    for stem in entries:
        if stem in {p.stem for p in folder.glob('*')} or not re.search(r'public domain|CC BY', entries[stem][1]):
            continue
        if any((root / 'assets/photos' / f'{stem}-1000.webp').exists() for _ in [0]):
            continue
        rep.warn('README.md', entries[stem][0], 'credits', f'{stem} is credited but no file with that name exists')


def check_fonts(rep, root, pages, css_name, css_text, faces):
    for line, body in faces:
        for ref in re.findall(r'url\(\s*["\']?([^)"\']+)', body):
            t = local_target(root, root / css_name, ref)
            if t is not None and not t.exists():
                rep.fail(css_name, line, 'fonts', f'@font-face file {ref} does not exist')
    for rel, page in pages.items():
        for el in page.elements:
            if el.tag == 'link' and el.attrs.get('rel') == 'preload' and el.attrs.get('as') == 'font':
                t = local_target(root, root / rel, el.attrs.get('href', ''))
                if t is None or not t.exists():
                    rep.fail(rel, el.line, 'fonts', f'font preload {el.attrs.get("href")} does not exist')
                elif 'crossorigin' not in el.attrs:
                    rep.fail(rel, el.line, 'fonts', f'font preload {el.attrs.get("href")} needs crossorigin or it is fetched twice')
                elif not any(str(t.relative_to(root)) in body.replace('"', '') or t.name in body for _, body in faces):
                    rep.warn(rel, el.line, 'fonts', f'preloaded {t.name} is not used by any @font-face')
    files = [(css_name, css_text)] + [(rel, (root / rel).read_text()) for rel in [*pages, 'main.js']]
    for name, text in files:
        for m in REMOVED_FONTS.finditer(text):
            rep.fail(name, text.count('\n', 0, m.start()) + 1, 'fonts', f'reference to removed font "{m.group(0)}"')


def check_head(rep, pages):
    titles, descs = defaultdict(list), defaultdict(list)
    for rel, page in pages.items():
        html = next((e for e in page.elements if e.tag == 'html'), None)
        if not html or html.attrs.get('lang') != 'en-GB':
            rep.fail(rel, html.line if html else 1, 'head', f'<html lang> is "{html.attrs.get("lang") if html else None}", expected en-GB')
        title = page.title.strip()
        if not title:
            rep.fail(rel, 1, 'head', 'missing <title>')
        titles[title].append(rel)
        d = meta(page, name='description')
        noindex = meta(page, name='robots')
        noindex = bool(noindex and 'noindex' in noindex.attrs.get('content', ''))
        if d is None or not d.attrs.get('content', '').strip():
            if not noindex:
                rep.fail(rel, 1, 'head', 'missing meta description')
        else:
            descs[d.attrs['content'].strip()].append(rel)
            n = len(d.attrs['content'])
            if n > 200:
                rep.warn(rel, d.line, 'head', f'meta description is {n} characters; search results cut it near 160')
        want = SITE if rel == 'index.html' else SITE + rel
        canon = meta(page, rel='canonical')
        ogurl = meta(page, property='og:url')
        if not noindex:
            for el, name in ((canon, 'canonical link'), (ogurl, 'og:url')):
                got = (el.attrs.get('href') or el.attrs.get('content')) if el else None
                if got != want:
                    rep.fail(rel, el.line if el else 1, 'head', f'{name} is {got!r}, expected {want!r}')
        ogt = meta(page, property='og:title')
        if ogt and ogt.attrs.get('content') != title:
            rep.warn(rel, ogt.line, 'head', 'og:title differs from <title>')
        h1 = [e for e in page.elements if e.tag == 'h1']
        if len(h1) != 1:
            rep.fail(rel, h1[1].line if len(h1) > 1 else 1, 'head', f'{len(h1)} h1 elements, expected one')
    for k, v in titles.items():
        if len(v) > 1 and k:
            rep.fail(v[1], 1, 'head', f'<title> "{k}" is also used by {v[0]}')
    for k, v in descs.items():
        if len(v) > 1:
            rep.fail(v[1], 1, 'head', f'meta description is also used by {v[0]}')


OXFORD = re.compile(r'(?<![\w’\'-])([\w’\'-]+(?: [\w’\'-]+){0,3}), ([\w’\'-]+(?: [\w’\'-]+){0,3}), (and|or) ')
BRAND_BAD = re.compile(r"Builders Quorum|Builders' Quorum|Builder's Quorum|Builder’s Quorum|Builders’ quorum")
QUORUM_ALONE = re.compile(r"(?<!Builders’ )(?<!Builders' )(?<!Builder's )(?<!Builders )(?<!BQ )\bQuorum\b")
FOUNDER_STYLE = [
    (re.compile(r'1% club', re.I), 'say "access is earned", not "1% club", in public copy'),
    (re.compile(r'\b(exclusive|elite)\b', re.I), 'selectivity should be shown as a standard, not claimed with "exclusive" or "elite"'),
    (re.compile(r'\bfree\b(?! press)', re.I), 'say "pilot first", not "free" (venues page excepted: it describes a free list)'),
    (re.compile(r"\bMasters['’] Union\b|\bMasters Union\b"), 'Masters’ Union must not appear on the site'),
]


def sentences(text):
    return [s for s in re.split(r'(?<=[.!?])\s+', text) if s]


def check_writing(rep, pages):
    for rel, page in pages.items():
        items = [(b, t, ln, b.in_footer()) for b, t, ln in page.block_texts()]
        items += [(None, t, ln, foot) for ln, t, foot, _ in page.attr_text]
        for b, text, ln, foot in items:
            if '—' in text or ' -- ' in text:
                rep.fail(rel, ln, 'writing-dash', f'em dash in "{text[:70]}"')
            if BRAND_BAD.search(text):
                rep.fail(rel, ln, 'writing-brand', f'brand should be spelled Builders’ Quorum: "{BRAND_BAD.search(text).group(0)}"')
            if QUORUM_ALONE.search(text):
                m = QUORUM_ALONE.search(text)
                rep.fail(rel, ln, 'writing-brand', f'"Quorum" on its own (write Builders’ Quorum or BQ): "…{text[max(0, m.start() - 25):m.end() + 15]}…"')
            m = next((m for m in OXFORD.finditer(text) if not re.search(r'\b(and|or)\b', m.group(2))), None)
            if m:
                rep.fail(rel, ln, 'writing-oxford', f'Oxford comma before "{m.group(3)}": "{m.group(0).strip()}…"')
            for rx, label in US_SPELLING:
                for m in rx.finditer(text):
                    rep.fail(rel, ln, 'writing-spelling', f'{label}: "{m.group(0)}"')
            for m in AI_WORDS.finditer(text):
                rep.fail(rel, ln, 'writing-words', f'word to avoid: "{m.group(0)}"')
            if not foot:
                for m in PLACES.finditer(text):
                    rep.fail(rel, ln, 'writing-places', f'"{m.group(0)}" outside the footer (the site is global first)')
            for rx, label in FOUNDER_STYLE:
                if rx.search(text):
                    if label.startswith('say "pilot') and rel == 'venues.html':
                        continue
                    rep.warn(rel, ln, 'writing-style', f'{label}: "{rx.search(text).group(0)}"')
            if re.search(r', not\b', text) or re.search(r'\bnot (?:just |only )?[\w’\' -]{1,30}, but\b', text):
                rep.warn(rel, ln, 'writing-contrast', f'"X, not Y" construction: "{text[:90]}"')
            if re.search(r':\s+[^.?!:]{1,80}\?', text):
                rep.warn(rel, ln, 'writing-reveal', f'colon-plus-question construction: "{text[:90]}"')
            if b is not None and b.tag == 'p':
                run = 0
                for s in sentences(text):
                    run = run + 1 if len(s.split()) <= 3 else 0
                    if run >= 2:
                        rep.warn(rel, ln, 'writing-fragments', f'stacked fragments in "{text[:90]}"')
                        break


def check_jsonld(rep, root, pages):
    """Every JSON-LD block parses; the FAQPage on a page matches its visible FAQ (README: edit both)."""
    for rel, page in pages.items():
        parsed = []
        for raw in re.findall(r'<script type="application/ld\+json">(.*?)</script>', (root / rel).read_text(), flags=re.S):
            try:
                parsed.append(json.loads(raw))
            except ValueError as e:
                rep.fail(rel, 1, 'jsonld', f'JSON-LD does not parse: {e}')
        faq = next((x for d in parsed for x in (d.get('@graph') or [d]) if x.get('@type') == 'FAQPage'), None)
        details = [e for e in page.elements if e.tag == 'details']
        if faq and details:
            qs = [q['name'] for q in faq['mainEntity']]
            vis = []
            for d in details:
                summ = next((c for c in d.children if c.tag == 'summary'), None)
                vis.append(re.sub(r'\s+', ' ', ''.join(summ.text)).strip() if summ else '')
            if qs != vis:
                rep.fail(rel, details[0].line, 'jsonld', 'FAQPage questions in the JSON-LD differ from the visible FAQ')


def check_generated(rep, root):
    """venues.html must be exactly what tools/build_venues.py writes from data/venues.json."""
    gen = root / 'tools/build_venues.py'
    if not gen.exists() or not (root / 'data/venues.json').exists():
        return
    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp)
        for name in ('partners.html', 'venues.html'):
            shutil.copy(root / name, t / name)
        (t / 'tools').mkdir()
        (t / 'data').mkdir()
        shutil.copy(gen, t / 'tools/build_venues.py')
        shutil.copy(root / 'tools/venues-sketch.html', t / 'tools/venues-sketch.html')
        shutil.copy(root / 'data/venues.json', t / 'data/venues.json')
        done = subprocess.run([sys.executable, '-I', str(t / 'tools/build_venues.py')], capture_output=True, text=True)
        if done.returncode:
            rep.fail('tools/build_venues.py', 1, 'generated', f'generator failed: {done.stderr.strip().splitlines()[-1:]}')
            return
        a = (root / 'venues.html').read_text().splitlines()
        b = (t / 'venues.html').read_text().splitlines()
        for i, (x, y) in enumerate(zip(a, b), 1):
            if x != y:
                rep.fail('venues.html', i, 'generated', 'differs from what tools/build_venues.py writes (edit data/venues.json or the generator, then rebuild)')
                return
        if len(a) != len(b):
            rep.fail('venues.html', min(len(a), len(b)) + 1, 'generated', 'length differs from what tools/build_venues.py writes')


def check_misc(rep, root, pages):
    sm = root / 'sitemap.xml'
    if sm.exists():
        text = sm.read_text()
        for m in re.finditer(r'<loc>[^<]*?/([\w.-]*)</loc>', text):
            name = m.group(1) or 'index.html'
            if not (root / name).exists():
                rep.fail('sitemap.xml', text.count('\n', 0, m.start()) + 1, 'links', f'{name} is in the sitemap but does not exist')
    for rel, page in pages.items():
        for el in page.elements:
            if el.tag == 'a' and el.attrs.get('target') == '_blank' and 'noopener' not in el.attrs.get('rel', ''):
                rep.warn(rel, el.line, 'links', 'target="_blank" without rel="noopener"')


# ---------------------------------------------------------------------------


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--root', default=str(Path(__file__).resolve().parent.parent))
    ap.add_argument('--quiet', action='store_true')
    ap.add_argument('--verbose', action='store_true', help='list every NOTE and every KNOWN occurrence')
    ap.add_argument('--collisions', action='store_true', help='also list every shared class, not only the conflicting ones')
    args = ap.parse_args()
    root = Path(args.root).resolve()
    rep = Report()

    names = sorted(p.name for p in root.glob('*.html'))
    pages = {n: Page(root / n, n) for n in names}
    css_path = root / 'styles.css'
    css_text = css_path.read_text()
    rules, faces = parse_css(css_text)

    check_collisions(rep, pages, rules, 'styles.css', args.collisions)
    check_links(rep, root, pages)
    check_css_urls(rep, root, css_path, css_text)
    if (root / 'main.js').exists():
        check_js_paths(rep, root, root / 'main.js')
    check_images(rep, root, pages)
    check_credits(rep, root, pages)
    check_fonts(rep, root, pages, 'styles.css', css_text, faces)
    check_head(rep, pages)
    check_writing(rep, pages)
    check_jsonld(rep, root, pages)
    check_generated(rep, root)
    check_misc(rep, root, pages)

    print(f'Checked {len(pages)} pages, {len(rules)} CSS rules in {root}')
    rep.print(args.quiet, args.verbose or args.collisions)
    sys.exit(1 if rep.failed else 0)


if __name__ == '__main__':
    main()
