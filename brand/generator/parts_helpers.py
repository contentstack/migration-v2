# -*- coding: utf-8 -*-
"""Asset loading + reusable HTML fragment builders."""
import os, re
from parts_css import *

SKILL = ("/root/.claude/skills/synced/"
         "56f1a097-af1d-48d2-8573-fbf32bcb18b9_7d872012-c87c-470d-b670-f5693141a14d/"
         "contentstack-brand-guidelines")
ASSETS = os.path.join(SKILL, "assets")

def _read(name):
    with open(os.path.join(ASSETS, name), encoding="utf-8") as f:
        return f.read().strip()

LOCKUP_SRC   = _read("Contentstack-LogoLockup-AmethystCrystalClear-RGB.svg")
LOGOMARK_SRC = _read("Contentstack-Logomark-Amethyst-RGB.svg")

def _sized(svg, css_size):
    """Strip fixed width/height so CSS controls size; keep viewBox geometry intact."""
    svg = re.sub(r'\swidth="[\d.]+"', '', svg, count=1)
    svg = re.sub(r'\sheight="[\d.]+"', '', svg, count=1)
    return svg.replace('<svg', '<svg style="%s"' % css_size, 1)

def lockup(height_mm, mark=AMETHYST, word="#F5F5F5"):
    """Primary lockup from the true-source file. Fills are swapped only to the four
    approved combinations in logo-guidelines.md; geometry is never redrawn."""
    svg = LOCKUP_SRC.replace('fill="#AC75FF"', 'fill="%s"' % mark)
    svg = svg.replace('fill="#F5F5F5"', 'fill="%s"' % word)
    return _sized(svg, "height:%smm;width:auto;display:block" % height_mm)

def logomark(height_mm, color=AMETHYST):
    svg = LOGOMARK_SRC.replace('fill="#AC75FF"', 'fill="%s"' % color)
    return _sized(svg, "height:%smm;width:auto;display:block" % height_mm)

ASSET_RATIO = {   # native width/height of each gradient asset
    "Title_Cover_Gradient.svg": 196 / 358,
    "Section_cover_gradient.svg": 246 / 575,
    "Rectangle_12892.svg": 123 / 387,
    "Layered_Gradients___Comp_03.svg": 214 / 328,
    "Stats_background_gradient_purple.svg": 480 / 270,
    "Stats_background_gradient_green.svg": 480 / 270,
}

def asset_ratio(filename):
    return ASSET_RATIO[filename]

def asset_gradient(filename, css_style, fit="cover"):
    """Inline a pre-built gradient asset as-is, resizing only via CSS.

    fit="cover" scales proportionally and crops the overflow (never distorts);
    fit="meet" fits inside the box. The stops are never touched. Gradient ids are
    namespaced per use so multiple inlines on one page cannot collide."""
    svg = _read(filename)
    uniq = re.sub(r'\W', '', filename)[:14]
    for gid in set(re.findall(r'id="(paint\d+_linear_[\w]+)"', svg)):
        svg = svg.replace(gid, gid + "_" + uniq)
    svg = re.sub(r'\swidth="[\d.]+"', '', svg, count=1)
    svg = re.sub(r'\sheight="[\d.]+"', '', svg, count=1)
    par = "xMidYMax slice" if fit == "cover" else "xMidYMid meet"
    svg = svg.replace('<svg', '<svg preserveAspectRatio="%s" style="%s"' % (par, css_style), 1)
    return svg

def grad_svg(stops, w=560, h=150, gid="g", horizontal=False):
    """Canonical named-gradient renderer. Stops are used verbatim - never hand-tuned."""
    x2, y2 = (w, 0) if horizontal else (0, h)
    s = "".join(
        '<stop offset="%s" stop-color="%s" stop-opacity="%s"/>' % (o, c, a)
        for o, c, a in stops)
    return (
        '<svg viewBox="0 0 %d %d" preserveAspectRatio="none" '
        'style="width:100%%;height:100%%;display:block" xmlns="http://www.w3.org/2000/svg">'
        '<rect width="%d" height="%d" fill="url(#%s)"/><defs>'
        '<linearGradient id="%s" x1="0" y1="0" x2="%d" y2="%d" '
        'gradientUnits="userSpaceOnUse">%s</linearGradient></defs></svg>'
        % (w, h, w, h, gid, gid, x2, y2, s))

# ---- page chrome ------------------------------------------------------------
def footer(pageno):
    return (
        '<div class="foot"><div class="l">'
        '<span class="mk">%s</span>'
        '<span class="c">&copy; 2026 Contentstack. All rights reserved.</span>'
        '</div><div class="pn">%02d</div></div>' % (logomark(6), pageno))

def head(section, title_right=""):
    return ('<div class="head"><div class="eyebrow" style="margin:0">%s</div>'
            '<div class="n">%s</div></div>' % (section, title_right))

def page(inner, pageno, footer_on=True, cls=""):
    f = footer(pageno) if footer_on else ""
    return '<div class="page %s">%s%s</div>' % (cls, inner, f)

# ---- small components -------------------------------------------------------
def swatch(name, hexv, role, textcol=None):
    if textcol is None:
        textcol = SHADOW_HEAVY if hexv.upper() in (
            CRYSTAL_CLEAR, AMETHYST, "#EBEBEA", "#E1E0E0", "#D4D4D3") else CRYSTAL_CLEAR
    return ('<div class="sw"><div class="fill" style="background:%s;color:%s">'
            '<span style="font-size:7pt;font-weight:600;letter-spacing:.1em;'
            'text-transform:uppercase;opacity:.72">%s</span></div>'
            '<div class="meta"><div class="nm">%s</div><div class="hx">%s</div>'
            '<div class="rl">%s</div></div></div>'
            % (hexv, textcol, hexv.replace("#", ""), name, hexv, role))

def chip(hexv, border=False):
    b = ";border:1px solid #393838" if border else ""
    return '<span class="chip" style="background:%s%s"></span>' % (hexv, b)

def tone_strip(tones):
    cells = []
    for tone, hexv, note in tones:
        lab = SHADOW_HEAVY if int(tone) <= 300 else CRYSTAL_CLEAR
        cells.append(
            '<div style="flex:1;min-width:0">'
            '<div style="height:20mm;background:%s;display:flex;align-items:flex-start;'
            'justify-content:center;padding-top:2mm">'
            '<span style="font-size:7.5pt;font-weight:600;color:%s;'
            'font-variant-numeric:tabular-nums">%s</span></div>'
            '<div style="padding:2mm .5mm 0;text-align:center">'
            '<div style="font-size:6pt;font-weight:500;color:#797777;'
            'font-variant-numeric:tabular-nums">%s</div>'
            '<div style="font-size:5.4pt;line-height:1.25;color:#484747;margin-top:.7mm">'
            '%s</div></div></div>' % (hexv, lab, tone, hexv, note))
    return ('<div style="display:flex;gap:1mm;border-radius:8px">%s</div>'
            % "".join(cells))

# ---- inline glyph substitutes -----------------------------------------------
# The Inter Latin subset has no U+2192 / U+2713 / U+2717, and falling back to a
# system font would break the "Inter for all generated text" rule. These SVGs
# inherit currentColor so they take the surrounding text colour.
ARROW = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
         'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" '
         'style="width:.62em;height:.62em;display:inline-block;vertical-align:baseline" '
         'xmlns="http://www.w3.org/2000/svg">'
         '<path d="M4 12h15"/><path d="M13 6l6 6-6 6"/></svg>')

TICK = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        'stroke-width="3" stroke-linecap="round" stroke-linejoin="round" '
        'style="width:.82em;height:.82em;display:inline-block;vertical-align:-.1em" '
        'xmlns="http://www.w3.org/2000/svg"><path d="M4 12.5l5.5 5.5L20 6.5"/></svg>')

CROSS = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
         'stroke-width="3" stroke-linecap="round" stroke-linejoin="round" '
         'style="width:.78em;height:.78em;display:inline-block;vertical-align:-.08em" '
         'xmlns="http://www.w3.org/2000/svg">'
         '<path d="M5.5 5.5l13 13"/><path d="M18.5 5.5l-13 13"/></svg>')


def resolve_glyphs(html):
    """Swap glyph tokens for their inline-SVG equivalents."""
    return (html.replace('__ARROW__', ARROW)
                .replace('__TICK__', TICK)
                .replace('__CROSS__', CROSS))
