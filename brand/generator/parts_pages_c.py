# -*- coding: utf-8 -*-
"""Pages 14-16: logo."""
from parts_css import *
from parts_helpers import *

def p_logo_combos():
    combos = [
      ("Primary","Dark backgrounds","Amethyst mark + Crystal Clear wordmark",
       SHADOW_HEAVY, AMETHYST, "#F5F5F5"),
      ("Secondary","Light backgrounds","Amethyst mark + Shadow Heavy wordmark",
       CRYSTAL_CLEAR, AMETHYST, SHADOW_HEAVY),
      ("Knockout","Busy or unclear backgrounds","Crystal Clear mark + wordmark",
       "#3C3550", CRYSTAL_CLEAR, CRYSTAL_CLEAR),
      ("Reversal","Busy light backgrounds","Shadow Heavy mark + wordmark",
       "#D2B7F9", SHADOW_HEAVY, SHADOW_HEAVY),
    ]
    cards = []
    for pri, bgdesc, treat, bg, mark, word in combos:
        cards.append(
          '<div style="background:#292928;border-radius:12px;overflow:hidden">'
          '<div style="background:%s;height:38mm;display:flex;align-items:center;'
               'justify-content:center;padding:6mm">%s</div>'
          '<div style="padding:3.5mm 4mm 4mm">'
          '<div style="font-size:6.5pt;font-weight:600;letter-spacing:.11em;'
          'text-transform:uppercase;color:#AC75FF">%s</div>'
          '<div style="font-size:9pt;font-weight:600;margin-top:1.4mm">%s</div>'
          '<div style="font-size:7pt;line-height:1.35;color:#797777;margin-top:1.5mm">'
          '%s</div></div></div>'
          % (bg, lockup(8.4, mark=mark, word=word), pri, bgdesc, treat))

    inner = (
      '<div class="pad">%s'
      '<div class="body">'
        '<div style="display:flex;gap:12mm;align-items:flex-start">'
          '<div style="flex:1"><h2>Lockup and logomark</h2>'
          '<p style="margin-top:3mm;max-width:118mm"><strong>Default to the full '
          'lockup</strong> (mark plus wordmark) in all situations. The logomark alone '
          'is permitted &mdash; not promoted &mdash; in two cases only: social media '
          'avatars, using the pre-built avatar files, and space-constrained contexts '
          'where the full lockup cannot fit legibly. Do not use the logomark as a '
          'general substitute.</p></div>'
          '<div style="flex:none;display:flex;gap:8mm;align-items:center;'
               'background:#292928;border-radius:12px;padding:8mm 10mm">'
            '<div style="text-align:center">%s'
            '<div class="cap" style="margin-top:3mm">Full lockup</div></div>'
            '<div style="width:1px;height:20mm;background:#393838"></div>'
            '<div style="text-align:center">%s'
            '<div class="cap" style="margin-top:3mm">Logomark</div></div>'
          '</div>'
        '</div>'
        '<h4 style="margin:7mm 0 3mm">Approved colour combinations &mdash; the logo must '
        'always appear in one of these four</h4>'
        '<div class="grid g4">%s</div>'
        '<p class="cap" style="margin-top:5mm">When in doubt, use the primary Amethyst '
        'and Crystal Clear version. Never recreate the logo &mdash; always place the '
        'official file. PNG is the default for digital use; EPS is the primary print '
        'format, with CMYK the default colour mode unless a vendor requests PMS.</p>'
      '</div></div>'
      % (head("04 &nbsp;Logo", "Lockup and approved colour"),
         lockup(9), logomark(14), "".join(cards)))
    return page(inner, 14)

def p_logo_space():
    # Clear space = height of the logomark on all four sides.
    cs = (
      '<div style="background:#292928;border-radius:12px;padding:7mm;'
           'display:flex;justify-content:center">'
        '<div style="position:relative;border:1px dashed #AC75FF;padding:11mm;'
             'display:inline-block">'
          '<div style="border:1px solid #393838;padding:0;display:block">%s</div>'
          '<span style="position:absolute;top:1.5mm;left:50%%;transform:translateX(-50%%);'
          'font-size:6pt;font-weight:600;color:#AC75FF">X</span>'
          '<span style="position:absolute;bottom:1.5mm;left:50%%;'
          'transform:translateX(-50%%);font-size:6pt;font-weight:600;color:#AC75FF">X</span>'
          '<span style="position:absolute;left:3mm;top:50%%;transform:translateY(-50%%);'
          'font-size:6pt;font-weight:600;color:#AC75FF">X</span>'
          '<span style="position:absolute;right:3mm;top:50%%;transform:translateY(-50%%);'
          'font-size:6pt;font-weight:600;color:#AC75FF">X</span>'
        '</div></div>' % lockup(11))

    # Co-branding: Contentstack left, thin Tone 400 divider, partner right.
    cb = (
      '<div style="background:#292928;border-radius:12px;padding:7mm;'
           'display:flex;align-items:center;justify-content:center;gap:9mm">'
        '%s'
        '<div style="width:1px;height:13mm;background:#9A9998"></div>'
        '<div style="display:flex;align-items:center;gap:2.5mm">'
          '<div style="width:9mm;height:9mm;border:1.4px solid #F5F5F4;'
               'border-radius:50%%"></div>'
          '<span style="font-size:11pt;font-weight:600;color:#F5F5F4;'
          'letter-spacing:-.01em">Partner</span></div>'
      '</div>' % lockup(7.5))

    minsize = (
      '<div style="background:#292928;border-radius:12px;padding:6mm;display:flex;'
           'align-items:flex-end;gap:7mm">'
        '<div style="text-align:center">%s'
        '<div class="cap" style="margin-top:2.5mm">18 px min</div></div>'
        '<div style="text-align:center">%s'
        '<div class="cap" style="margin-top:2.5mm">18 px min</div></div>'
        '<div style="flex:1"><p style="font-size:8pt">Both the full lockup and the '
        'logomark have a minimum height of <strong>18 px</strong> for digital use. '
        'Do not scale below this &mdash; legibility and recognition break down.</p>'
        '</div></div>' % (lockup(4.76), logomark(4.76)))

    inner = (
      '<div class="pad">%s'
      '<div class="body" style="display:flex;gap:12mm">'
        '<div style="width:118mm;flex:none">'
          '<h2>Clear space and sizing</h2>'
          '<p style="margin-top:3mm">Maintain minimum clear space equal to the '
          '<strong>height of the logomark</strong> on all four sides. Never crowd the '
          'logo with text, images or other elements, and keep it clear of edges, folds '
          'and distractions.</p>'
          '<div style="margin-top:5mm">%s</div>'
          '<p class="cap" style="margin-top:2.5mm">X = the height of the logomark. Do '
          'not crop the logomark too close to the edge in avatars, or place the lockup '
          'too close to the edge of a composition.</p>'
          '<h4 style="margin:6mm 0 2.5mm">Minimum size</h4>%s'
        '</div>'
        '<div style="flex:1">'
          '<h4 style="margin-bottom:2.5mm">Co-branding</h4>'
          '<p style="margin-bottom:4mm">Used frequently in prospect and partner decks.</p>'
          '%s'
          '<ul style="margin-top:5mm">'
          '<li>Contentstack logo on the <strong>left</strong>, partner logo on the '
          '<strong>right</strong></li>'
          '<li>Separate the two with a thin vertical divider in Tone 400 '
          '<strong>#9A9998</strong></li>'
          '<li>Both logos get equal visual weight and spacing</li>'
          '<li>Dark mode preferred &mdash; Amethyst and Crystal Clear Contentstack '
          'logo, partner logo in Crystal Clear or white</li>'
          '<li>Works with the full lockup or logomark-only, depending on space</li>'
          '</ul>'
        '</div>'
      '</div></div>'
      % (head("04 &nbsp;Logo", "Clear space, sizing, co-branding"), cs, minsize, cb))
    return page(inner, 15)

def p_logo_donts():
    donts = [
      ("Alternative lockups or unapproved colours", "outline"),
      ("Outlining any part of the logo", "outline2"),
      ("Special effects &mdash; shadows, glows, or gradients on the logo itself", "glow"),
      ("Rotating or stretching the logo", "stretch"),
      ("Placing the logo on low-contrast backgrounds", "lowcon"),
    ]
    def demo(kind):
        if kind == "outline":
            return ('<div style="background:#1A1919;height:30mm;display:flex;'
                    'align-items:center;justify-content:center">%s</div>'
                    % lockup(7.5, mark="#FF9E3D", word="#7BE0A0"))
        if kind == "outline2":
            return ('<div style="background:#1A1919;height:30mm;display:flex;'
                    'align-items:center;justify-content:center">'
                    '<div style="-webkit-text-stroke:.4mm #F5F5F4;filter:'
                    'drop-shadow(0 0 0 #fff)">%s</div></div>'
                    % lockup(7.5, mark="transparent", word="transparent")
                    .replace('fill="transparent"',
                             'fill="none" stroke="#F5F5F4" stroke-width="6"'))
        if kind == "glow":
            return ('<div style="background:#1A1919;height:30mm;display:flex;'
                    'align-items:center;justify-content:center">'
                    '<div style="filter:drop-shadow(0 0 3mm #AC75FF)">%s</div></div>'
                    % lockup(7.5))
        if kind == "stretch":
            return ('<div style="background:#1A1919;height:30mm;display:flex;'
                    'align-items:center;justify-content:center;overflow:hidden">'
                    '<div style="transform:scaleY(1.9) rotate(-8deg)">%s</div></div>'
                    % lockup(6))
        return ('<div style="background:#4A4560;height:30mm;display:flex;'
                'align-items:center;justify-content:center">%s</div>'
                % lockup(7.5, mark="#5B5470", word="#565064"))

    cards = "".join(
      '<div style="background:#292928;border-radius:12px;overflow:hidden">'
      '<div style="position:relative">%s'
        '<div style="position:absolute;top:2.5mm;right:2.5mm;width:5mm;height:5mm;'
             'border-radius:50%%;background:#FF8A8A;display:flex;align-items:center;'
             'justify-content:center;font-size:7pt;font-weight:700;color:#1A1919">'
             '__CROSS__</div></div>'
      '<div style="padding:3.5mm 4mm 4mm"><div style="font-size:7.5pt;line-height:1.4;'
      'color:#C7C7C6">%s</div></div></div>' % (demo(k), t) for t, k in donts)

    inner = (
      '<div class="pad">%s'
      '<div class="body">'
        '<div style="display:flex;justify-content:space-between;align-items:flex-end;'
             'gap:12mm">'
          '<div style="max-width:150mm"><h2>Logo don&rsquo;ts</h2>'
          '<p style="margin-top:3mm">The logo is a fixed asset. Place the official '
          'file &mdash; never redraw, recolour outside the four approved combinations, '
          'or decorate it.</p></div>'
          '<div class="callout" style="max-width:86mm">'
          '<p style="font-size:8pt">For any variant, colour or print format beyond the '
          'bundled source files, use the official asset library rather than modifying '
          'a logo by hand.</p></div>'
        '</div>'
        '<div class="grid" style="grid-template-columns:repeat(5,1fr);margin-top:6mm">'
        '%s</div>'
        '<div class="rule" style="margin:7mm 0 5mm"></div>'
        '<div style="display:flex;gap:10mm">'
          '<div style="flex:1"><h4 style="margin-bottom:2.5mm">File formats &mdash; digital</h4>'
          '<ul><li class="dash"><strong>PNG</strong> &mdash; default for all digital use: '
          'presentations, documents, web, social</li>'
          '<li class="dash"><strong>SVG</strong> &mdash; only if specifically requested</li>'
          '<li class="dash"><strong>JPG</strong> &mdash; legacy fallback only; do not '
          'recommend</li></ul></div>'
          '<div style="flex:1"><h4 style="margin-bottom:2.5mm">File formats &mdash; print</h4>'
          '<ul><li class="dash"><strong>EPS</strong> &mdash; primary format for print '
          'vendors</li>'
          '<li class="dash"><strong>PDF</strong> &mdash; alternative if a vendor requests '
          'it</li>'
          '<li class="dash"><strong>CMYK</strong> default; <strong>PMS</strong> coated or '
          'uncoated only on vendor request</li></ul></div>'
          '<div style="flex:1"><h4 style="margin-bottom:2.5mm">Avatars and favicon</h4>'
          '<ul><li class="dash">Square avatar &mdash; Shadow Heavy mark on an Amethyst '
          'square; crops to circle</li>'
          '<li class="dash">Circle avatar &mdash; only where a platform requires it</li>'
          '<li class="dash">Favicon &mdash; Amethyst mark on transparent, web only</li>'
          '</ul></div>'
        '</div>'
      '</div></div>' % (head("04 &nbsp;Logo", "Don&rsquo;ts and formats"), cards))
    return page(inner, 16)
