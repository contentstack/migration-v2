# -*- coding: utf-8 -*-
"""Convert the WinnDixie Migration Architecture artifact into a print PDF.

Keeps the artifact's own editorial theme and content verbatim; replaces the
screen layout (sticky sidebar, two-column grid) with a paginated document:
cover, contents, then single-column sections. The artifact's bundled mermaid
runtime is carried over so all 18 diagrams render offline.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ARTIFACT = ("/root/.claude/projects/-workspace-migration-v2/"
            "708c9e6a-453b-5a1d-8e73-0fb324e216c6/tool-results/"
            "artifact-f30d16ac-1787865890-02ca.html")

src = open(ARTIFACT, encoding="utf-8").read()
body = src[src.find("<body>") + len("<body>"):]

# ---- carve the artifact into its parts ------------------------------------
theme_css = re.search(r"<style>(.*?)</style>", body, re.S).group(1)
nav_html  = body[body.find('<nav class="toc"'):body.find("</nav>") + len("</nav>")]
main_html = body[body.find("<main"):body.find("</main>") + len("</main>")]
runtime   = body[body.find("<!--claude-mermaid-runtime-begin"):]

fonts_css = open(os.path.join(HERE, "fonts", "report-fonts.css"), encoding="utf-8").read()

n_diagrams = main_html.count('class="mermaid"')

# ---- restore the authored line breaks in diagram labels -------------------
# The mermaid sources carry literal <br/> tags, which the browser parses as real
# elements inside <pre>; the runtime reads pre.textContent, where a <br> element
# contributes nothing, so "master DB<br/>every version" arrived as
# "master DBevery version". Escaping the tag makes it survive as text, and
# securityLevel 'loose' lets mermaid turn it back into a line break. The only
# markup in these labels is <br/>, and the document is the user's own content.
def _escape_brs(html):
    return re.sub(r'(<pre class="mermaid">)(.*?)(</pre>)',
                  lambda m: m.group(1) + m.group(2).replace("<br/>", "&lt;br/&gt;")
                            + m.group(3),
                  html, flags=re.S)

n_breaks = sum(b.count("<br/>") for b in
               re.findall(r'<pre class="mermaid">(.*?)</pre>', main_html, re.S))
main_html = _escape_brs(main_html)
runtime = runtime.replace("securityLevel:'strict'", "securityLevel:'loose'")

# ---- lift the cover material out of <main> --------------------------------
inner = main_html[main_html.find(">") + 1:main_html.rfind("</main>")]
m_kicker = re.search(r'<p class="kicker">(.*?)</p>', inner, re.S)
m_h1     = re.search(r"<h1[^>]*>(.*?)</h1>", inner, re.S)
m_lede   = re.search(r'<p class="lede">(.*?)</p>', inner, re.S)
m_facts  = re.search(r'<div class="facts">.*?</div>\s*</div>', inner, re.S)
kicker = m_kicker.group(1).strip() if m_kicker else ""
title  = m_h1.group(1).strip() if m_h1 else "Document"
lede   = m_lede.group(1).strip() if m_lede else ""
facts  = m_facts.group(0) if m_facts else ""
for part in (m_kicker, m_h1, m_lede, m_facts):
    if part:
        inner = inner.replace(part.group(0), "", 1)

# ---- contents: reuse the artifact's own nav, drop the anchors -------------
toc_inner = re.sub(r"</?nav[^>]*>", "", nav_html)
toc_inner = re.sub(r'<a href="[^"]*"', '<span class="tl"', toc_inner)
toc_inner = toc_inner.replace("</a>", "</span>")


def keep_blocks(html):
    """Wrap <h2 with eyebrow> ... first </pre> in a keep-together div."""
    out, pos, n = [], 0, 0
    for m in re.finditer(r'<h2[^>]*>\s*<small>', html):
        end = html.find("</pre>", m.start())
        if end == -1:
            continue
        end += len("</pre>")
        out.append(html[pos:m.start()])
        out.append('<div class="keep">' + html[m.start():end] + "</div>")
        pos = end
        n += 1
    out.append(html[pos:])
    return "".join(out), n

inner, n_keep = keep_blocks(inner)

PRINT_CSS = """
/* ---------- print scaffolding ---------- */
@page { size: A4 portrait; margin: 17mm 16mm 19mm; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { background: var(--panel); font-size: 9.6pt; line-height: 1.55; }

/* the artifact's screen shell: sidebar + max-width column -> flowing page */
.wrap { display: block !important; max-width: none !important; margin: 0 !important;
        padding: 0 !important; gap: 0 !important; }
nav.toc { display: none !important; }
main { max-width: none !important; min-width: 0 !important; }

/* Keep each section's heading, its intro and its diagram on one page. Forcing a
   page break before every section instead would leave ~24 near-empty tail pages,
   and letting them flow freely orphans a heading above a diagram that no longer
   fits. The wrapper moves as a unit, so the space it vacates is taken by the
   previous section's text. */
.keep { break-inside: avoid; page-break-inside: avoid; }

/* ---------- cover ---------- */
.cover { break-after: page; page-break-after: always; height: 246mm;
         display: flex; flex-direction: column; }
.cover .rule-top { height: 4px; background: var(--accent); width: 74mm; margin-bottom: 13mm; }
.cover h1 { font: 600 40pt/1.03 var(--display); letter-spacing: -.022em;
            margin: 0 0 7mm; text-wrap: balance; }
.cover .kicker { font: 600 8.5pt/1 var(--body); letter-spacing: .15em;
                 text-transform: uppercase; color: var(--accent); margin: 0 0 5mm; }
.cover .lede { font-size: 11.5pt; line-height: 1.5; color: var(--mut);
               max-width: 148mm; margin: 0; }
.cover .spacer { flex: 1; }
.cover .facts { margin: 0 0 12mm; }
.cover .meta { display: flex; gap: 12mm; border-top: 1px solid var(--line);
               padding-top: 5mm; }
.cover .meta div { font-size: 8pt; color: var(--mut); }
.cover .meta b { display: block; font: 600 9.5pt/1.3 var(--body); color: var(--ink);
                 margin-top: 1mm; }

/* ---------- contents ---------- */
.contents { break-after: page; page-break-after: always; }
.contents h2 { font: 600 22pt/1.1 var(--display); border: 0; padding: 0;
               margin: 0 0 8mm; }
.contents .cols { columns: 2; column-gap: 12mm; }
.contents .k { font: 600 7.5pt/1 var(--body); letter-spacing: .14em;
               text-transform: uppercase; color: var(--accent);
               margin: 5mm 0 2mm; break-after: avoid; }
.contents .k:first-child { margin-top: 0; }
.contents .tl { display: block; font-size: 8.8pt; line-height: 1.45; color: var(--ink);
                padding: .9mm 0 .9mm 3mm; border-left: 2px solid var(--line);
                break-inside: avoid; }

/* ---------- pagination behaviour ---------- */
h2 { break-before: auto; break-after: avoid; page-break-after: avoid; }
h3, h4 { break-after: avoid; page-break-after: avoid; }
h2 + *, h3 + * { break-before: avoid; }
p, li { orphans: 3; widows: 3; }
table, figure, .fact, .note, .gloss, .pill { break-inside: avoid;
                                             page-break-inside: avoid; }
tr, thead { break-inside: avoid; }
thead { display: table-header-group; }

/* Diagrams never split and never exceed the text block. 205mm keeps the four very
   tall, narrow flowcharts legible (they scale to ~62%); clamping to 165mm packs
   three pages tighter but shrinks their labels to roughly 6pt. */
.mermaid-diagram { break-inside: avoid; page-break-inside: avoid;
                   margin: 5mm auto 6mm; text-align: center; }
.mermaid-diagram svg { max-width: 100% !important; max-height: 205mm !important;
                       height: auto !important; width: auto !important;
                       margin: 0 auto; }
pre.mermaid { display: none !important; }   /* source hidden once rendered */

/* wide tables must fit the page, not scroll */
table { font-size: 8.4pt; width: 100%; }
th, td { padding: 1.7mm 2.4mm; }
div[style*="overflow-x"], .tbl { overflow: visible !important; }

img { max-width: 100%; height: auto; break-inside: avoid; }
a { color: var(--ink); text-decoration: none; }
"""

HTML = """<!doctype html>
<html lang="en" data-theme="light"><head><meta charset="utf-8">
<title>%(title)s</title>
<style>%(fonts)s</style>
<style>%(theme)s</style>
<style>%(print)s</style>
</head><body>
<div class="wrap"><main>
  <section class="cover">
    <div class="rule-top"></div>
    <p class="kicker">%(kicker)s</p>
    <h1>%(title)s</h1>
    <p class="lede">%(lede)s</p>
    <div class="spacer"></div>
    %(facts)s
    <div class="meta">
      <div>Prepared<b>%(date)s</b></div>
      <div>Scope<b>Sitecore export &rarr; Contentstack on Azure</b></div>
      <div>Diagrams<b>%(nd)d, drawn from the live export</b></div>
    </div>
  </section>
  <section class="contents">
    <h2>Contents</h2>
    <div class="cols">%(toc)s</div>
  </section>
  %(inner)s
</main></div>
%(runtime)s
</body></html>
""" % dict(title=title, fonts=fonts_css, theme=theme_css, print=PRINT_CSS,
           kicker=kicker, lede=lede, facts=facts, toc=toc_inner, inner=inner,
           runtime=runtime, nd=n_diagrams, date="August 2026")

out = os.path.join(HERE, "report-print.html")
open(out, "w", encoding="utf-8").write(HTML)
print("diagrams to render: %d" % n_diagrams)
print("diagram line breaks restored: %d" % n_breaks)
print("heading+diagram blocks kept together: %d" % n_keep)
print("wrote %s (%.0f KB)" % (out, os.path.getsize(out) / 1024))
