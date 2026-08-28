# -*- coding: utf-8 -*-
"""Render report-print.html to PDF, waiting for every mermaid diagram first."""
import os, sys
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "report-print.html")
OUT = os.path.join(HERE, "WinnDixie-Migration-Architecture.pdf")
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
EXPECTED = 18

def _footer():
    """Chromium renders the header/footer template in an isolated document that
    does not inherit page styles, so the web font has to be inlined again or the
    page numbers fall back to a system sans."""
    css = open(os.path.join(HERE, "fonts", "report-fonts.css"), encoding="utf-8").read()
    face = next((f for f in css.split("\n")
                 if "Public Sans" in f and "font-weight:400" in f), "")
    return ("<style>%s</style>"
            "<div style=\"width:100%%;font:8pt 'Public Sans',sans-serif;"
            "color:#8A929B;padding:0 16mm;display:flex;"
            "justify-content:space-between;\">"
            "<span style=\"letter-spacing:.06em;\">WinnDixie Migration Architecture</span>"
            "<span>Page <span class=\"pageNumber\"></span> of "
            "<span class=\"totalPages\"></span></span></div>" % face)

FOOTER = _footer()

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=CHROME,
                                 args=["--no-sandbox", "--disable-dev-shm-usage",
                                       "--font-render-hinting=none"])
    page = browser.new_page(viewport={"width": 1240, "height": 1754})
    page.goto("file://" + SRC, wait_until="load", timeout=180_000)
    page.emulate_media(media="print", color_scheme="light")

    # the artifact's runtime renders diagrams asynchronously
    try:
        page.wait_for_function(
            "sel => document.querySelectorAll(sel).length >= %d" % EXPECTED,
            arg=".mermaid-diagram svg", timeout=180_000)
    except Exception:
        got = page.eval_on_selector_all(".mermaid-diagram svg", "els => els.length")
        print("WARNING: only %d/%d diagrams rendered" % (got, EXPECTED))

    page.wait_for_timeout(2500)          # let final layout settle
    stats = page.evaluate("""() => ({
        diagrams: document.querySelectorAll('.mermaid-diagram svg').length,
        unrendered: document.querySelectorAll('pre.mermaid:not([data-claude-mermaid-claimed])').length,
        fontsReady: document.fonts.status,
        newsreader: document.fonts.check("600 40pt Newsreader"),
        publicsans: document.fonts.check("400 10pt 'Public Sans'"),
        mono: document.fonts.check("400 10pt 'JetBrains Mono'"),
        tallest: Math.max(0, ...[...document.querySelectorAll('.mermaid-diagram svg')]
                    .map(s => s.getBoundingClientRect().height)),
        widest: Math.max(0, ...[...document.querySelectorAll('table')]
                    .map(t => t.scrollWidth - t.clientWidth)),
    })""")
    for k, v in stats.items():
        print("  %-11s %s" % (k, v))

    page.pdf(path=OUT, format="A4", print_background=True,
             display_header_footer=True,
             header_template="<div></div>", footer_template=FOOTER,
             margin={"top": "17mm", "bottom": "19mm", "left": "16mm", "right": "16mm"})
    browser.close()

print("\nwrote %s (%.0f KB)" % (OUT, os.path.getsize(OUT) / 1024))
