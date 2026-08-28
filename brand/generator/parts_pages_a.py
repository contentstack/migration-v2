# -*- coding: utf-8 -*-
"""Pages 1-9: cover, contents, ethos, colour section."""
from parts_css import *
from parts_helpers import *

def p_cover():
    inner = (
      '<div style="position:absolute;top:0;right:0;height:210mm;width:115mm;overflow:hidden">%s</div>'
      '<div style="position:absolute;inset:0;padding:20mm 18mm">'
        '<div style="display:flex;flex-direction:column;height:100%%">'
          '<div>%s</div>'
          '<div style="flex:1"></div>'
          '<div style="max-width:168mm">'
            '<div class="eyebrow">Visual Identity System</div>'
            '<h1>Brand<br/>Guidelines</h1>'
            '<p style="font-size:11.5pt;line-height:1.5;color:#B3B2B2;margin-top:7mm;'
                'max-width:132mm">Colour, typography, logo, iconography, data '
                'visualisation and photography &mdash; the complete reference for '
                'anything visual made for Contentstack.</p>'
          '</div>'
          '<div style="flex:1"></div>'
          '<div style="display:flex;gap:14mm;align-items:flex-end">'
            '<div><div class="cap" style="color:#484747">Edition</div>'
            '<div style="font-size:9pt;font-weight:500;color:#9A9998;margin-top:1mm">'
            'August 2026</div></div>'
            '<div><div class="cap" style="color:#484747">Applies to</div>'
            '<div style="font-size:9pt;font-weight:500;color:#9A9998;margin-top:1mm">'
            'All generated visual output</div></div>'
            '<div><div class="cap" style="color:#484747">Working typeface</div>'
            '<div style="font-size:9pt;font-weight:500;color:#9A9998;margin-top:1mm">'
            'Inter</div></div>'
          '</div>'
        '</div></div>'
      % (asset_gradient("Title_Cover_Gradient.svg",
                        "width:100%;height:100%;display:block"),
         lockup(9)))
    return page(inner, 1, footer_on=False)

CONTENTS = [
    ("01", "Foundation", [("Brand ethos and application tiers", 3)]),
    ("02", "Colour", [("Core palette", 5), ("Secondary and grayscale", 6),
                      ("Gradients", 7), ("Usage rules and accessibility", 8),
                      ("Extended utility families", 9)]),
    ("03", "Typography", [("Typefaces and type styles", 11),
                          ("Slide type scale", 12)]),
    ("04", "Logo", [("Lockup, logomark and approved colour", 14),
                    ("Clear space, sizing and co-branding", 15),
                    ("Logo don&rsquo;ts", 16)]),
    ("05", "Applications", [("Iconography", 18),
                            ("Charts and data visualisation", 19),
                            ("Photography", 20)]),
]

FREQ = [
    ("Most often", "Core palette &mdash; Crystal Clear, Shadow Heavy, Amethyst and "
     "grayscale", "Everyday go-to for all applications"),
    ("Occasionally", "Gradients &mdash; Chroma, Prism, Aura, Tide",
     "High-impact, expressive moments"),
    ("Sparingly", "Utility palette &mdash; extended families",
     "Charts, UI states, accents, subtle pops"),
]
FREQ_ROWS = "".join(
    '<tr><td style="width:26mm"><strong>%s</strong></td><td>%s</td>'
    '<td style="width:62mm">%s</td></tr>' % f for f in FREQ)

def p_contents():
    cols = []
    for num, title, rows in CONTENTS:
        items = "".join(
            '<div style="display:flex;justify-content:space-between;gap:4mm;'
            'padding:1.7mm 0;border-bottom:1px solid #292928">'
            '<span style="font-size:8.5pt;color:#C7C7C6">%s</span>'
            '<span style="font-size:8pt;font-weight:500;color:#626160;'
            'font-variant-numeric:tabular-nums">%02d</span></div>' % (t, p)
            for t, p in rows)
        cols.append(
            '<div style="margin-bottom:6mm">'
            '<div style="display:flex;align-items:baseline;gap:3mm;margin-bottom:2.5mm">'
            '<span style="font-size:8pt;font-weight:600;color:#AC75FF;'
            'font-variant-numeric:tabular-nums">%s</span>'
            '<span style="font-size:12pt;font-weight:600;color:#F5F5F4;'
            'letter-spacing:-.01em">%s</span></div>%s</div>' % (num, title, items))
    half = 3
    left, right = "".join(cols[:half]), "".join(cols[half:])
    inner = (
      '<div class="pad">%s'
      '<div class="body" style="display:flex;gap:16mm">'
        '<div style="width:74mm;flex:none">'
          '<h2>Contents</h2>'
          '<p style="margin-top:4mm;max-width:62mm">Every section states the rule, '
          'the exact value, and when it applies. Where a rule is an accessibility '
          'requirement it is marked as non-negotiable.</p>'
          '<div style="margin-top:9mm;width:14mm;height:44mm;overflow:hidden">%s</div>'
        '</div>'
        '<div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:0 12mm">'
          '<div>%s</div><div>%s</div>'
        '</div>'
      '</div></div>'
      % (head("Contents", "Brand Guidelines"),
         asset_gradient("Rectangle_12892.svg", "width:100%;height:100%;display:block"),
         left, right))
    return page(inner, 2)

def p_divider(num, title, blurb, pageno):
    inner = (
      '<div style="position:absolute;top:0;right:0;bottom:0;width:105mm;overflow:hidden">%s</div>'
      '<div style="position:absolute;inset:0;padding:15mm 18mm;display:flex;'
           'flex-direction:column;justify-content:center">'
        '<div style="max-width:150mm">'
          '<div style="font-size:8pt;font-weight:600;color:#AC75FF;letter-spacing:.16em;'
               'margin-bottom:5mm">SECTION %s</div>'
          '<h1 style="font-size:54pt">%s</h1>'
          '<p style="font-size:11pt;line-height:1.5;color:#B3B2B2;margin-top:6mm;'
             'max-width:112mm">%s</p>'
        '</div></div>'
      % (asset_gradient("Section_cover_gradient.svg",
                        "width:100%;height:100%;display:block"), num, title, blurb))
    return page(inner, pageno)

def p_ethos():
    tiers = [
      ("1", "Light", "Ad-hoc charts, internal data, quick one-off reports",
       "Brand colours only; transparent background matched to the host surface. "
       "No dark container, no card, no decoration."),
      ("2", "Standard", "Team dashboards, multi-KPI layouts, structured internal reports",
       "Dark surfaces plus the full palette; eyebrows and cards where appropriate."),
      ("3", "Full", "Marketing, sales decks, customer-facing material, explicit "
       "&ldquo;on-brand&rdquo; requests", "Tier 2 plus gradients, logo and rich layout."),
    ]
    trows = "".join(
      '<tr><td style="width:8mm"><span style="font-size:13pt;font-weight:700;'
      'color:#AC75FF">%s</span></td>'
      '<td style="width:24mm"><strong>%s</strong></td>'
      '<td style="width:66mm">%s</td><td>%s</td></tr>' % t for t in tiers)

    principles = [
      ("Dark-first", "Shadow Heavy is the primary surface. Light mode is fully valid "
       "and audience-appropriate &mdash; it is a choice, not a fallback."),
      ("Amethyst drives the system", "Amethyst is the brand personality, not merely an "
       "accent. It appears in typography, iconography, illustration and as a full "
       "background."),
      ("Accessibility is non-negotiable", "Contrast rules are brand rules. Amethyst "
       "changes value on light backgrounds; text on Amethyst is always Shadow Heavy."),
      ("Inter for all generated text", "Tercia is reserved for the internal design "
       "team. Never substitute a third typeface."),
    ]
    plist = "".join(
      '<div style="margin-bottom:4mm"><h3 style="color:#F5F5F4">%s</h3>'
      '<p style="margin-top:1.2mm">%s</p></div>' % p for p in principles)

    inner = (
      '<div class="pad">%s'
      '<div class="body" style="display:flex;gap:14mm">'
        '<div style="width:104mm;flex:none">'
          '<h2>Brand ethos</h2>'
          '<div style="margin-top:6mm">%s</div>'
        '</div>'
        '<div style="flex:1;display:flex;flex-direction:column">'
          '<div class="callout"><div class="k">The core rule</div>'
          '<p>Never use generic or tool-default colour schemes. Chart.js, D3 and '
          'Visualizer defaults are off-brand. When in doubt, use Amethyst '
          '<strong>#AC75FF</strong> on a Shadow Heavy <strong>#1A1919</strong> '
          'background.</p></div>'
          '<div class="rule"></div>'
          '<h4 style="margin-bottom:3mm">Application tiers &mdash; choose before anything else</h4>'
          '<table><thead><tr><th></th><th>Tier</th><th>When to use</th>'
          '<th>Treatment</th></tr></thead><tbody>%s</tbody></table>'
          '<p class="cap" style="margin-top:4mm">When the audience is unstated, default '
          'to Tier&nbsp;1 for analytical or internal work. Step up to Tier&nbsp;3 only on '
          'an explicit marketing, customer-facing or &ldquo;on-brand&rdquo; cue.</p>'
          '<div class="rule"></div>'
          '<h4 style="margin-bottom:2.5mm">Output format</h4>'
          '<p>Default to inline charts and widgets. Build a standalone file or '
          'dashboard only when asked for one, or when the layout genuinely needs '
          'multiple chart types or metric cards.</p>'
        '</div>'
      '</div></div>' % (head("01 &nbsp;Foundation", "Ethos and tiers"), plist, trows))
    return page(inner, 3)

def p_core_palette():
    sw = "".join(swatch(n, h, r) for n, h, r in CORE)
    inner = (
      '<div class="pad">%s'
      '<div class="body">'
        '<div style="display:flex;justify-content:space-between;align-items:flex-end;'
             'gap:12mm">'
          '<div style="max-width:150mm"><h2>Core palette</h2>'
          '<p style="margin-top:3mm">The foundation of all visual communication and '
          'the most frequently used colours in the system.</p></div>'
          '<p class="cap" style="max-width:74mm;text-align:right">Avoid pure black '
          '#000000 and pure white #FFFFFF &mdash; neither is a Contentstack '
          'brand colour.</p>'
        '</div>'
        '<div class="grid g3" style="margin-top:8mm">%s</div>'
        '<div style="display:flex;gap:6mm;margin-top:8mm">'
          '<div class="callout" style="flex:1"><div class="k">Amethyst is not an accent</div>'
          '<p>It drives the visual style and is one of the most important colours in '
          'the system &mdash; used for typography on dark, iconography, illustration '
          'and as a full background.</p></div>'
          '<div style="flex:1;background:#292928;border-radius:12px;padding:5mm;'
               'display:flex;gap:5mm;align-items:center">'
            '<div style="width:22mm;height:22mm;border-radius:8px;background:#8A38F5;'
                 'flex:none"></div>'
            '<div><div style="font-size:9.5pt;font-weight:600">Accessible Amethyst</div>'
            '<div style="font-size:8pt;font-weight:500;color:#AC75FF;margin-top:.6mm">'
            '#8A38F5</div>'
            '<p style="font-size:7.5pt;margin-top:2mm">Substitute for #AC75FF on light '
            'backgrounds &mdash; type, icons and chart fills alike. #AC75FF fails '
            'contrast on light.</p></div>'
          '</div>'
        '</div>'
      '</div></div>' % (head("02 &nbsp;Colour", "Core palette"), sw))
    return page(inner, 5)

def p_secondary():
    sec = "".join(
      '<div style="background:#292928;border-radius:10px;overflow:hidden">'
      '<div style="height:15mm;background:%s"></div>'
      '<div style="padding:3mm">'
      '<div style="font-size:8.5pt;font-weight:600">%s</div>'
      '<div style="font-size:7.5pt;font-weight:500;color:#AC75FF;margin-top:.5mm">%s</div>'
      '<div style="font-size:6.5pt;line-height:1.3;color:#797777;margin-top:1.5mm">%s</div>'
      '</div></div>' % (h, n, h, u) for n, h, u in SECONDARY)
    inner = (
      '<div class="pad">%s'
      '<div class="body">'
        '<h2>Secondary and grayscale</h2>'
        '<p style="margin-top:3mm;max-width:186mm">Secondary colours add flexibility '
        'and depth without overpowering the primary palette. The grayscale utility '
        'scale carries text hierarchy, borders and neutral UI, referenced by numeric '
        'tone value.</p>'
        '<h4 style="margin:7mm 0 3mm">Secondary colours</h4>'
        '<div class="grid" style="grid-template-columns:repeat(6,1fr)">%s</div>'
        '<h4 style="margin:8mm 0 3mm">Grayscale utility scale</h4>'
        '%s'
        '<div class="rule" style="margin:8mm 0 5mm"></div>'
        '<h4 style="margin-bottom:2.5mm">Colour usage frequency</h4>'
        '<table><tbody>%s</tbody></table>'
      '</div></div>'
      % (head("02 &nbsp;Colour", "Secondary and grayscale"), sec,
         tone_strip(GRAYSCALE), FREQ_ROWS))
    return page(inner, 6)

def p_gradients():
    cards = []
    for i, (name, kind, use, stops) in enumerate(GRADIENTS):
        rows = "".join(
          '<div style="display:flex;align-items:center;gap:2.5mm;padding:1.1mm 0">'
          '%s<span style="font-size:7pt;font-weight:500;color:#9A9998;width:16mm;'
          'font-variant-numeric:tabular-nums">%s</span>'
          '<span style="font-size:7pt;color:#626160;font-variant-numeric:tabular-nums">'
          '%s%% opacity &middot; stop %s%%</span></div>'
          % (chip(c), c, int(a * 100), int(o * 100)) for o, c, a in stops)
        cards.append(
          '<div style="background:#292928;border-radius:12px;overflow:hidden">'
          '<div style="height:30mm;background:#1A1919">%s</div>'
          '<div style="padding:4mm">'
          '<div style="display:flex;justify-content:space-between;align-items:baseline">'
          '<span style="font-size:11pt;font-weight:600">%s</span>'
          '<span style="font-size:6.5pt;font-weight:500;letter-spacing:.1em;'
          'text-transform:uppercase;color:#797777">%s</span></div>'
          '<p style="font-size:7.5pt;margin-top:1.5mm;color:#9A9998">%s</p>'
          '<div style="margin-top:2.5mm;border-top:1px solid #393838;padding-top:1.5mm">'
          '%s</div></div></div>'
          % (grad_svg(stops, gid="grad%d" % i), name, kind, use, rows))
    inner = (
      '<div class="pad">%s'
      '<div class="body">'
        '<div style="display:flex;justify-content:space-between;align-items:flex-end;'
             'gap:12mm">'
          '<div style="max-width:146mm"><h2>Gradients</h2>'
          '<p style="margin-top:3mm">A core expressive element, not a decorative '
          'add-on. Only the four gradients below are approved.</p></div>'
          '<div class="callout" style="max-width:88mm;border-color:#AC75FF">'
          '<p style="font-size:8pt"><strong>Use occasionally, not constantly.</strong> '
          'The core palette dominates; gradients appear in high-impact moments. '
          'Never apply a gradient to text, and never hand-tune the stops.</p></div>'
        '</div>'
        '<div class="grid g4" style="margin-top:6mm">%s</div>'
        '<p class="cap" style="margin-top:6mm">Each gradient is a vertical, '
        'top-to-bottom linear fill. Slide-ready compositions of Chroma and Prism ship '
        'as pre-built SVG assets &mdash; cover, section, ribbon and stat-background '
        'variants &mdash; and should be used as-is rather than rebuilt.</p>'
      '</div></div>' % (head("02 &nbsp;Colour", "Gradients"), "".join(cards)))
    return page(inner, 7)
