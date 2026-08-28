# -*- coding: utf-8 -*-
"""Assemble the Contentstack Brand Guidelines HTML, then render to PDF via Chromium."""
import os, sys, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from parts_css import CSS
from parts_helpers import *
from parts_pages_a import (p_cover, p_contents, p_divider, p_ethos,
                           p_core_palette, p_secondary, p_gradients)
from parts_pages_b import p_usage_rules, p_families, p_typefaces, p_slide_type
from parts_pages_c import p_logo_combos, p_logo_space, p_logo_donts
from parts_pages_d import p_icons, p_charts, p_photography, p_closing

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_CSS = open(os.path.join(HERE, "..", "fonts", "inter-static.css"),
                encoding="utf-8").read()

PAGES = [
    p_cover(),
    p_contents(),
    p_ethos(),
    p_divider("02", "Colour",
              "The core palette, the secondary and grayscale scales, the four approved "
              "gradients, and the accessibility rules that govern every one of them.", 4),
    p_core_palette(),
    p_secondary(),
    p_gradients(),
    p_usage_rules(),
    p_families(),
    p_divider("03", "Typography",
              "Two typefaces, one working font for everything generated, and a fixed "
              "type scale that is never improvised per slide.", 10),
    p_typefaces(),
    p_slide_type(),
    p_divider("04", "Logo",
              "The full lockup leads. Four approved colour combinations, fixed clear "
              "space, a hard minimum size, and a short list of things never to do.", 13),
    p_logo_combos(),
    p_logo_space(),
    p_logo_donts(),
    p_divider("05", "Applications",
              "How the system lands in practice &mdash; iconography, charts and data "
              "visualisation, and the photography library.", 17),
    p_icons(),
    p_charts(),
    p_photography(),
    p_closing(),
]

HTML = (
  '<!doctype html><html lang="en"><head><meta charset="utf-8">'
  '<title>Contentstack Brand Guidelines</title>'
  '<style>%s</style><style>%s</style></head><body>%s</body></html>'
  % (FONT_CSS, CSS, resolve_glyphs("".join(PAGES))))

out_html = os.path.join(HERE, "brand-guidelines.html")
with open(out_html, "w", encoding="utf-8") as f:
    f.write(HTML)
print("pages assembled: %d" % len(PAGES))
print("html: %s (%.1f KB)" % (out_html, os.path.getsize(out_html) / 1024))
