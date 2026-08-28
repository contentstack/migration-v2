# -*- coding: utf-8 -*-
"""Pages 8-12: colour rules, utility families, typography."""
from parts_css import *
from parts_helpers import *

def p_usage_rules():
    modes = [
      ("Dark mode", "Primary expression", "#1A1919", "#F5F5F4",
       [("Background", "Shadow Heavy #1A1919"), ("Primary text", "Crystal Clear #F5F5F4"),
        ("Amethyst", "#AC75FF for key typographic moments, icons, filled shapes")]),
      ("Light mode", "Audience-dependent, fully valid", "#F5F5F4", "#1A1919",
       [("Background", "Crystal Clear #F5F5F4 or Crystal Sheer #EBEBEA"),
        ("Primary text", "Shadow Heavy #1A1919, or grayscale 700&ndash;950"),
        ("Amethyst", "#8A38F5 Accessible Amethyst &mdash; #AC75FF fails contrast")]),
      ("Amethyst background", "Critical accessibility rule", "#AC75FF", "#1A1919",
       [("All text, logos, icons", "Shadow Heavy #1A1919 &mdash; required"),
        ("Crystal Clear", "Never &mdash; #F5F5F4 is not accessible on Amethyst"),
        ("", "")]),
    ]
    cards = []
    for title, sub, bg, fg, rows in modes:
        rlist = "".join(
          '<div style="display:flex;gap:3mm;padding:1.5mm 0;border-top:1px solid #393838">'
          '<span style="font-size:7pt;font-weight:600;color:#797777;width:26mm;flex:none">'
          '%s</span><span style="font-size:7.5pt;line-height:1.35;color:#C7C7C6">%s</span>'
          '</div>' % (k, v) for k, v in rows if k or v)
        cards.append(
          '<div style="background:#292928;border-radius:12px;overflow:hidden">'
          '<div style="background:%s;color:%s;padding:5mm;height:26mm">'
          '<div style="font-size:10.5pt;font-weight:600">%s</div>'
          '<div style="font-size:7pt;font-weight:500;letter-spacing:.08em;'
          'text-transform:uppercase;opacity:.78;margin-top:1.2mm">%s</div>'
          '<div style="font-size:14pt;font-weight:600;margin-top:2.5mm">'
          'Aa</div></div>'
          '<div style="padding:3mm 4mm 4mm">%s</div></div>'
          % (bg, fg, title, sub, rlist))

    acc = [("Amethyst on dark backgrounds", "#AC75FF", True),
           ("Amethyst on light / Crystal Clear backgrounds", "#8A38F5", True),
           ("Crystal Clear on an Amethyst background", "Never &mdash; fails contrast", False),
           ("Shadow Heavy on an Amethyst background", "Required", True)]
    arows = "".join(
      '<tr><td>%s</td><td style="width:52mm"><span class="%s">%s</span> %s</td></tr>'
      % (s, "ok" if ok else "no", "__TICK__" if ok else "__CROSS__", v)
      for s, v, ok in acc)

    inner = (
      '<div class="pad">%s'
      '<div class="body">'
        '<h2>Usage rules and accessibility</h2>'
        '<p style="margin-top:3mm;max-width:200mm">Accessibility is a core brand '
        'principle, not an afterthought. When applying colour to copy or small icons, '
        'always verify the correct Amethyst value for the background.</p>'
        '<div class="grid g3" style="margin-top:6mm">%s</div>'
        '<div style="display:flex;gap:8mm;margin-top:7mm">'
          '<div style="flex:1.35"><h4 style="margin-bottom:2.5mm">Contrast reference</h4>'
          '<table><tbody>%s</tbody></table></div>'
          '<div style="flex:1"><h4 style="margin-bottom:2.5mm">Also avoid</h4>'
          '<ul>'
          '<li class="dash">Too many colours in a single piece</li>'
          '<li class="dash">Layering excessive gradients on coloured backgrounds</li>'
          '<li class="dash">Pure black #000000 or pure white #FFFFFF as primary '
          'brand colours</li>'
          '<li class="dash">Gradients applied to text</li>'
          '</ul>'
          '<p class="cap" style="margin-top:3.5mm">On dark gradients use Crystal Clear '
          'or white text; on light gradients use Accessible Amethyst #8A38F5 for any '
          'Amethyst-coloured type or icon.</p></div>'
        '</div>'
      '</div></div>'
      % (head("02 &nbsp;Colour", "Usage and accessibility"), "".join(cards), arows))
    return page(inner, 8)

def p_families():
    rows = []
    for fam, variants in FAMILIES:
        cells = "".join(
          '<div style="flex:1">'
          '<div style="height:14mm;background:%s;border-radius:8px"></div>'
          '<div style="font-size:7pt;font-weight:600;color:#C7C7C6;margin-top:2mm">%s</div>'
          '<div style="font-size:6.5pt;font-weight:500;color:#797777;margin-top:.4mm;'
          'font-variant-numeric:tabular-nums">%s</div></div>' % (h, v, h)
          for v, h in variants)
        rows.append(
          '<div style="display:flex;gap:5mm;align-items:flex-start;margin-bottom:5mm">'
          '<div style="width:26mm;flex:none;padding-top:4mm">'
          '<div style="font-size:10pt;font-weight:600">%s</div>'
          '<div style="font-size:6.5pt;color:#797777;margin-top:.8mm">family</div></div>'
          '<div style="flex:1;display:flex;gap:3mm">%s</div></div>' % (fam, cells))

    inner = (
      '<div class="pad">%s'
      '<div class="body">'
        '<h2>Extended utility families</h2>'
        '<p style="margin-top:3mm;max-width:200mm">For charts, UI states or technical '
        'needs beyond the core palette. Use sparingly &mdash; these support the system, '
        'they do not lead it.</p>'
        '<div style="margin-top:7mm">%s</div>'
        '<div class="rule" style="margin:5mm 0 4mm"></div>'
        '<div style="display:flex;gap:9mm">'
          '<div style="flex:1"><h4 style="margin-bottom:2mm">How to use them</h4>'
          '<p>Reach for a utility family only when the core palette cannot carry the '
          'distinction &mdash; a fourth chart series, a UI state, a background tint. '
          'Accent matches the core chart order; Subtle and Light are for backgrounds, '
          'Shade and Dark for depth on dark surfaces.</p></div>'
          '<div style="flex:1"><h4 style="margin-bottom:2mm">Keep it restrained</h4>'
          '<p>Too many colours in one piece is an explicit don&rsquo;t. If a layout '
          'needs more than the five-step chart series, the answer is usually fewer '
          'series &mdash; not more colours.</p></div>'
        '</div>'
      '</div></div>'
      % (head("02 &nbsp;Colour", "Utility families"), "".join(rows)))
    return page(inner, 9)

def p_typefaces():
    styles = [
      ("Eyebrow header","Inter","Medium","1%","120%",
       "Brief uppercase label for source/design and web contexts. Never on slide content."),
      ("Headline","Tercia","Regular","0%","110%","Primary display / attention-grabbing text"),
      ("Large header","Tercia","Regular","1%","110%","Section titles"),
      ("Small header","Inter","Medium","0%","130%","Supporting context beneath headlines"),
      ("Quotes","Tercia","Light","1%","130%","Key messages and pull quotes"),
      ("Large body","Inter","Regular","0%","150%","Short-form content, intro paragraphs"),
      ("Body","Inter","Regular","0%","150%","Default paragraph style"),
      ("Captions","Inter","Regular","0%","130%","Image labels, notes, supplementary detail"),
    ]
    srows = "".join(
      '<tr><td style="width:30mm"><strong>%s</strong></td>'
      '<td style="width:16mm;color:%s">%s</td><td style="width:19mm">%s</td>'
      '<td style="width:15mm" class="mono">%s</td>'
      '<td style="width:15mm" class="mono">%s</td><td>%s</td></tr>'
      % (n, "#AC75FF" if f == "Tercia" else "#C7C7C6", f, w, ls, lh, u)
      for n, f, w, ls, lh, u in styles)

    specimen = "".join(
      '<div style="display:flex;align-items:baseline;gap:4mm;padding:1.6mm 0;'
      'border-bottom:1px solid #292928">'
      '<span style="font-size:6.5pt;font-weight:500;color:#626160;width:20mm;flex:none">'
      '%s</span>'
      '<span style="font-size:17pt;font-weight:%d;letter-spacing:-.01em">Aa Bb Cc 123</span>'
      '</div>' % (label, w) for label, w in
      [("Light 300",300),("Regular 400",400),("Medium 500",500),
       ("Semibold 600",600),("Bold 700",700)])

    inner = (
      '<div class="pad">%s'
      '<div class="body" style="display:flex;gap:12mm">'
        '<div style="width:96mm;flex:none">'
          '<h2>Typefaces</h2>'
          '<p style="margin-top:3mm">Contentstack uses two typefaces. '
          '<strong>Never introduce a third.</strong></p>'
          '<div class="callout" style="margin-top:5mm">'
            '<div class="k">Critical rule</div>'
            '<p>Tercia is reserved for the internal design team. In generated output '
            '&mdash; HTML, SVG, charts, documents, decks &mdash; <strong>Inter is the '
            'working font for all text</strong>. Do not substitute another font for '
            'Tercia.</p></div>'
          '<table style="margin-top:5mm"><thead><tr><th>Font</th><th>Role</th>'
          '<th>Availability</th></tr></thead><tbody>'
          '<tr><td><strong class="am">Tercia</strong></td>'
          '<td>Primary / display &mdash; headlines, large headers, quotes</td>'
          '<td>Internal design team only</td></tr>'
          '<tr><td><strong>Inter</strong></td>'
          '<td>Secondary / body &mdash; body copy, UI, captions, labels, eyebrows, '
          'chart text</td><td>Publicly available</td></tr>'
          '</tbody></table>'
          '<h4 style="margin:6mm 0 2mm">Inter specimen &mdash; this document</h4>%s'
        '</div>'
        '<div style="flex:1">'
          '<h4 style="margin-bottom:2.5mm">Type styles</h4>'
          '<table><thead><tr><th>Style</th><th>Font</th><th>Weight</th>'
          '<th>Tracking</th><th>Leading</th><th>Usage</th></tr></thead>'
          '<tbody>%s</tbody></table>'
          '<p class="cap" style="margin-top:3.5mm">Rows mapped to Tercia describe '
          'internal design-team source files only. They do not apply to generated '
          'output or to slide decks.</p>'
          '<div class="rule"></div>'
          '<h4 style="margin-bottom:2.5mm">Typography rules</h4>'
          '<ul>'
          '<li>Eyebrow labels are uppercase Inter Medium &mdash; web and marketing '
          'contexts only, never on slides</li>'
          '<li>Amethyst #AC75FF may emphasise type on dark; use #8A38F5 on light</li>'
          '<li>Do not track text too tightly or loosely; avoid widows</li>'
          '<li>Do not outline text; do not use unapproved fonts</li>'
          '</ul>'
        '</div>'
      '</div></div>'
      % (head("03 &nbsp;Typography", "Typefaces and styles"), specimen, srows))
    return page(inner, 11)

def p_slide_type():
    sizes = [("Title-slide headline","84 pt","Cover, Section and Closing hero"),
             ("Content-slide title","54 pt","Always &mdash; never improvise a content title size"),
             ("Subtitle","28 pt","Optional, beneath the content title"),
             ("Body copy","24 pt",""),
             ("Pointers (bullets)","24 pt","Rounded markers, Crystal Clear in dark mode"),
             ("Page number","11 pt","Bottom right"),
             ("Footer copyright","9 pt","Bottom left, after the stack icon")]
    rows = "".join(
      '<tr><td style="width:52mm"><strong>%s</strong></td>'
      '<td style="width:20mm"><span class="am" style="font-weight:600">%s</span></td>'
      '<td>%s</td></tr>' % s for s in sizes)

    scale = "".join(
      '<div style="display:flex;align-items:baseline;gap:4mm;margin-bottom:2.5mm">'
      '<span style="font-size:6.5pt;font-weight:500;color:#626160;width:13mm;flex:none;'
      'text-align:right">%s</span>'
      '<span style="font-size:%spt;font-weight:%d;line-height:1;letter-spacing:-.02em;'
      'color:%s">%s</span></div>' % (lab, size, w, col, txt)
      for lab, size, w, col, txt in
      [("84 pt","27",700,"#F5F5F4","Headline"),
       ("54 pt","17.5",700,"#F5F5F4","Content title"),
       ("28 pt","9",500,"#B3B2B2","Subtitle"),
       ("24 pt","7.8",400,"#C7C7C6","Body copy"),
       ("11 pt","3.6",500,"#797777","Page number"),
       ("9 pt","2.9",400,"#484747","Footer copyright")])

    inner = (
      '<div class="pad">%s'
      '<div class="body" style="display:flex;gap:12mm">'
        '<div style="width:112mm;flex:none">'
          '<h2>Slide type scale</h2>'
          '<p style="margin-top:3mm">Slide decks use Inter exclusively &mdash; there is '
          'no Tercia in a deck. Every text element is Inter: headlines and large headers '
          'in Bold, subheads and labels in Semibold or Medium, plus quotes, body, '
          'captions and footer.</p>'
          '<div class="callout" style="margin-top:5mm">'
            '<div class="k">Non-negotiable constants</div>'
            '<p>Authoring canvas is exactly <strong>20 in &times; 11.25 in</strong> '
            '(16:9) &mdash; never 13.333 &times; 7.5 in. Type sizes are fixed: do not '
            'improvise them per slide. Content slides carry a title and an optional '
            'subtitle &mdash; <strong>never an eyebrow</strong>.</p></div>'
          '<table style="margin-top:5mm"><thead><tr><th>Element</th><th>Size</th>'
          '<th>Notes</th></tr></thead><tbody>%s</tbody></table>'
        '</div>'
        '<div style="flex:1">'
          '<h4 style="margin-bottom:4mm">Relative scale</h4>'
          '<div style="background:#292928;border-radius:12px;padding:6mm 5mm">%s</div>'
          '<p class="cap" style="margin-top:3mm">Shown proportionally, reduced to fit '
          'this page.</p>'
          '<div class="rule"></div>'
          '<h4 style="margin-bottom:2.5mm">Slide footer</h4>'
          '<div style="background:#292928;border-radius:12px;padding:5mm;'
               'display:flex;align-items:center;justify-content:space-between">'
            '<div style="display:flex;align-items:center;gap:3mm">%s'
            '<span style="font-size:7pt;color:#484747">&copy; 2026 Contentstack. '
            'All rights reserved.</span></div>'
            '<span style="font-size:9pt;font-weight:500;color:#797777">12</span></div>'
          '<p class="cap" style="margin-top:3mm">On content slides the stack icon sits '
          'bottom-left at exactly 0.41 in &times; 0.5 in, followed by the 9 pt '
          'copyright line, with the 11 pt page number bottom-right. Scaled '
          'proportionally here for an A4 page.</p>'
        '</div>'
      '</div></div>'
      % (head("03 &nbsp;Typography", "Slide type scale"), rows, scale, logomark(7)))
    return page(inner, 12)
