# -*- coding: utf-8 -*-
"""Pages 18-21: iconography, charts, photography, closing."""
from parts_css import *
from parts_helpers import *

def _mkicon(paths, stroke="#8C8C8C"):
    """Marketing icon per spec: 48x48 on a 24x24 grid, 1.5px stroke,
    one or two shapes filled Amethyst."""
    return ('<svg viewBox="0 0 24 24" style="width:17mm;height:17mm;display:block" '
            'fill="none" stroke="%s" stroke-width="1.5" '
            'xmlns="http://www.w3.org/2000/svg">%s</svg>' % (stroke, paths))

ICONS = [
  ("Content", '<rect x="3" y="3" width="18" height="4" fill="#AC75FF" stroke="none"/>'
              '<rect x="3" y="3" width="18" height="4"/>'
              '<rect x="3" y="10" width="18" height="4"/>'
              '<rect x="3" y="17" width="18" height="4"/>'),
  ("Delivery", '<path d="M3 12h13"/><path d="M12 6l6 6-6 6"/>'
               '<circle cx="20" cy="12" r="2" fill="#AC75FF" stroke="none"/>'),
  ("Personalise", '<circle cx="12" cy="8" r="4"/>'
                  '<path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>'
                  '<circle cx="19" cy="5" r="2.5" fill="#AC75FF" stroke="none"/>'),
  ("Composable", '<rect x="3" y="3" width="8" height="8"/>'
                 '<rect x="13" y="3" width="8" height="8" fill="#AC75FF" stroke="none"/>'
                 '<rect x="13" y="3" width="8" height="8"/>'
                 '<rect x="3" y="13" width="8" height="8"/>'
                 '<rect x="13" y="13" width="8" height="8"/>'),
]

def p_icons():
    cards = "".join(
      '<div style="background:#292928;border-radius:12px;padding:5mm;text-align:center">'
      '<div style="display:flex;justify-content:center">%s</div>'
      '<div style="font-size:7pt;color:#797777;margin-top:3.5mm">%s</div></div>'
      % (_mkicon(p), n) for n, p in ICONS)

    util = [("Style","Sharp"),("Weight","300"),("Grade","Normal"),
            ("Fill","Off"),("Optical size","24 dp")]
    urows = "".join(
      '<div style="display:flex;justify-content:space-between;padding:1.7mm 0;'
      'border-bottom:1px solid #393838">'
      '<span style="font-size:8pt;color:#9A9998">%s</span>'
      '<span style="font-size:8pt;font-weight:600;color:#F5F5F4">%s</span></div>'
      % u for u in util)

    art = [("Grid","Design at 48 &times; 48 px on a 48 px scale, using a 24 &times; 24 grid"),
           ("Structure","Reference Google Material Symbols (Sharp) as a structural guide"),
           ("Stroke weight","1.5 px"),
           ("Stroke colour","Dark mode #8C8C8C &nbsp;&middot;&nbsp; Light mode #575757"),
           ("Fill","Highlight <strong>one or two shapes only</strong> with Amethyst "
            "#AC75FF &mdash; never fill every shape")]
    arows = "".join(
      '<div style="display:flex;gap:4mm;padding:2mm 0;border-bottom:1px solid #292928">'
      '<span style="font-size:7pt;font-weight:600;color:#797777;width:26mm;flex:none">'
      '%s</span><span style="font-size:8pt;line-height:1.4;color:#C7C7C6">%s</span></div>'
      % a for a in art)

    inner = (
      '<div class="pad">%s'
      '<div class="body" style="display:flex;gap:12mm">'
        '<div style="width:120mm;flex:none">'
          '<h2>Iconography</h2>'
          '<p style="margin-top:3mm">Contentstack uses two icon types with distinct '
          'purposes. Retrieve existing icon assets from the shared library rather than '
          'generating from scratch where they are available.</p>'
          '<h4 style="margin:6mm 0 3mm">Marketing icons</h4>'
          '<p style="margin-bottom:3mm">Expressive, custom illustrations used to tell '
          'the brand story &mdash; more visual and characterful than utility icons.</p>'
          '<div class="grid g4">%s</div>'
          '<div style="margin-top:5mm">%s</div>'
        '</div>'
        '<div style="flex:1">'
          '<h4 style="margin-bottom:3mm">Utility icons</h4>'
          '<p style="margin-bottom:4mm">Functional icons used across product, marketing '
          'and layout. Clarity-first, not expressive.</p>'
          '<div style="background:#292928;border-radius:12px;padding:5mm">'
          '<div style="font-size:7pt;font-weight:600;letter-spacing:.1em;'
          'text-transform:uppercase;color:#AC75FF;margin-bottom:2.5mm">'
          'Google Material Symbols settings</div>%s</div>'
          '<div class="rule"></div>'
          '<h4 style="margin-bottom:2.5mm">Principles</h4>'
          '<ul>'
          '<li>Use icons to support clarity, not as decoration</li>'
          '<li>Place them only where visual context genuinely improves understanding</li>'
          '<li>Maintain consistent sizing and alignment</li>'
          '<li>Avoid overuse</li>'
          '</ul>'
        '</div>'
      '</div></div>'
      % (head("05 &nbsp;Applications", "Iconography"), cards, arows, urows))
    return page(inner, 18)

def _barchart():
    data = [("Q1",58),("Q2",72),("Q3",64),("Q4",86)]
    W,H = 300,150
    pad_l, pad_b, pad_t = 6, 20, 8
    maxv = 100
    bw = (W - pad_l) / len(data) * 0.52
    gap = (W - pad_l) / len(data)
    bars, labs = [], []
    for i,(lab,v) in enumerate(data):
        h = (v/maxv)*(H-pad_b-pad_t)
        x = pad_l + i*gap + (gap-bw)/2
        y = H-pad_b-h
        bars.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="2" '
                    'fill="#AC75FF"/>' % (x,y,bw,h))
        labs.append('<text x="%.1f" y="%d" fill="#797777" font-size="8" '
                    'font-family="Inter" text-anchor="middle">%s</text>'
                    % (x+bw/2, H-pad_b+11, lab))
    grid = "".join('<line x1="0" y1="%.1f" x2="%d" y2="%.1f" stroke="rgba(255,255,255,0.06)" '
                   'stroke-width="1"/>' % (H-pad_b-(g/maxv)*(H-pad_b-pad_t), W,
                                           H-pad_b-(g/maxv)*(H-pad_b-pad_t))
                   for g in (25,50,75,100))
    return ('<svg viewBox="0 0 %d %d" style="width:100%%;height:auto;display:block" '
            'xmlns="http://www.w3.org/2000/svg">%s%s%s</svg>'
            % (W,H,grid,"".join(bars),"".join(labs)))

def p_charts():
    spec = [("Outer background","#1A1919 Shadow Heavy"),
            ("Card / surface","#292928 Shadow Medium"),
            ("Border radius","12 px"),("Font","Inter throughout"),
            ("Axis tick labels","#797777"),
            ("Grid lines","rgba(255,255,255,0.06)"),
            ("Tooltip bg / border","#292928 / #393838"),
            ("Tooltip title / body","#9A9998 / #F5F5F4")]
    srows = "".join(
      '<div style="display:flex;justify-content:space-between;gap:3mm;padding:1.5mm 0;'
      'border-bottom:1px solid #393838">'
      '<span style="font-size:7.5pt;color:#9A9998">%s</span>'
      '<span style="font-size:7.5pt;font-weight:600;color:#F5F5F4;'
      'font-variant-numeric:tabular-nums;text-align:right">%s</span></div>'
      % s for s in spec)

    series = "".join(
      '<div style="display:flex;align-items:center;gap:2.5mm;padding:1.3mm 0">'
      '<span style="font-size:7pt;font-weight:600;color:#484747;width:4mm;'
      'font-variant-numeric:tabular-nums">%d</span>%s'
      '<span style="font-size:7.5pt;color:#C7C7C6;flex:1">%s</span>'
      '<span style="font-size:7pt;font-weight:500;color:#797777;'
      'font-variant-numeric:tabular-nums">%s</span></div>'
      % (i+1, chip(h), n, h) for i,(h,n) in enumerate(SERIES))

    ladder = [("Single metric or dimension","Bare chart only &mdash; no cards, no eyebrow"),
              ("Multiple KPIs or comparative context","Add metric cards for key figures only"),
              ("Explicit dashboard or report request",
               "Full treatment &mdash; eyebrow, metric cards, source caption, rich layout")]
    lrows = "".join(
      '<div style="padding:2.2mm 0;border-bottom:1px solid #292928">'
      '<div style="font-size:8pt;font-weight:600;color:#F5F5F4">%s</div>'
      '<div style="font-size:7.5pt;line-height:1.4;color:#9A9998;margin-top:.8mm">'
      '%s</div></div>' % l for l in ladder)

    example = (
      '<div style="background:#292928;border-radius:12px;padding:5mm">'
        '<div style="font-size:6.5pt;font-weight:500;letter-spacing:.12em;'
        'text-transform:uppercase;color:#AC75FF;margin-bottom:1.8mm">Quarterly</div>'
        '<div style="font-size:9.5pt;font-weight:600;margin-bottom:4mm">'
        'Tier 2 chart &mdash; card, eyebrow, source caption</div>'
        '%s'
        '<div style="font-size:6pt;color:#484747;margin-top:2.5mm">'
        'Source: illustrative sample data</div>'
      '</div>' % _barchart())

    inner = (
      '<div class="pad">%s'
      '<div class="body" style="display:flex;gap:11mm">'
        '<div style="width:88mm;flex:none">'
          '<h2>Charts and data</h2>'
          '<p style="margin-top:3mm"><strong>Never use Chart.js, D3 or other tool '
          'defaults</strong> &mdash; they are off-brand. Match output complexity to '
          'request complexity; do not default to the richest treatment.</p>'
          '<h4 style="margin:6mm 0 2mm">Container and canvas</h4>'
          '<div>%s</div>'
        '</div>'
        '<div style="width:74mm;flex:none">'
          '<h4 style="margin-bottom:2mm">Multi-series colour order</h4>'
          '<div style="background:#292928;border-radius:12px;padding:4mm">%s</div>'
          '<h4 style="margin:6mm 0 2.5mm">Titles and labels</h4>'
          '<ul>'
          '<li>Always include a chart title &mdash; #F5F5F4, Inter Semibold</li>'
          '<li>Eyebrow labels &mdash; #AC75FF, Inter Medium, uppercase</li>'
          '<li>Source caption where known &mdash; 11 px, #484747</li>'
          '</ul>'
        '</div>'
        '<div style="flex:1">%s'
          '<h4 style="margin:6mm 0 2.5mm">Complexity ladder</h4>'
          '<table><tbody>%s</tbody></table>'
          '<p class="cap" style="margin-top:3.5mm"><strong>Tier 1 charts</strong> carry '
          'no card or container. On a light surface use #8A38F5 fills, #888 ticks and '
          'rgba(0,0,0,0.06) grid lines; on a dark surface use #AC75FF fills, #797777 '
          'ticks and rgba(255,255,255,0.06) grid lines.</p>'
        '</div>'
      '</div></div>'
      % (head("05 &nbsp;Applications", "Charts and data visualisation"),
         srows, series, example, lrows))
    return page(inner, 19)

def p_photography():
    sections = [
      ("01","Industries and use cases","Vertical landing pages, solution pages",
       "Localisation, Personalisation, Portals &amp; Knowledge Bases; CPG, Tech, Retail, "
       "E-commerce, Travel, Financial Services, Manufacturing"),
      ("02","Personas","Audience-targeted pages and campaigns",
       "Business leaders, digital leaders, developers &amp; IT &mdash; cast to match "
       "the role"),
      ("03","General","Anything without a specific vertical or persona fit",
       "Broad business lifestyle &mdash; the safe default"),
      ("04","Perspective","Hero banners, mood, editorial, storytelling",
       "Atmospheric lifestyle &mdash; lead with feeling and environment"),
    ]
    srows = "".join(
      '<div style="display:flex;gap:4mm;padding:2.4mm 0;border-bottom:1px solid #292928">'
      '<span style="font-size:7.5pt;font-weight:600;color:#AC75FF;width:6mm;flex:none;'
      'font-variant-numeric:tabular-nums">%s</span>'
      '<div style="flex:1"><div style="font-size:8.5pt;font-weight:600">%s</div>'
      '<div style="font-size:7pt;color:#9A9998;margin-top:.5mm">%s</div>'
      '<div style="font-size:6.8pt;line-height:1.35;color:#626160;margin-top:1mm">%s</div>'
      '</div></div>' % s for s in sections)

    direction = [
      ("Subjects","People are the heart of nearly every image. Casting is deliberately "
       "diverse and inclusive across ethnicity, age and gender, with strong natural "
       "representation of women in leadership, developer and customer roles."),
      ("Environments","Modern, bright and aspirational but believable &mdash; open-plan "
       "offices, glass-walled meeting rooms, home offices, caf&eacute;s, retail floors, "
       "server rooms, city streets. Context is kept, never stripped to a blank studio."),
      ("Technology","Shown in use, never as a hero product shot. The recurring beat is "
       "people getting things done with digital tools."),
      ("Mood","Overwhelmingly positive and energetic &mdash; confident, productive and "
       "human. Even focused shots read as purposeful rather than tense."),
      ("Light and composition","Natural, bright, airy light with clean contemporary "
       "colour. Candid framing, shallow depth of field, dynamic angles where useful, "
       "and intentional copy space for headlines."),
    ]
    drows = "".join(
      '<div style="margin-bottom:3.2mm"><div style="font-size:7pt;font-weight:600;'
      'letter-spacing:.09em;text-transform:uppercase;color:#797777;margin-bottom:1mm">'
      '%s</div><p style="font-size:8pt">%s</p></div>' % d for d in direction)

    inner = (
      '<div class="pad">%s'
      '<div class="body" style="display:flex;gap:11mm">'
        '<div style="width:92mm;flex:none">'
          '<h2>Photography</h2>'
          '<div class="callout" style="margin-top:5mm">'
            '<div class="k">The look in one line</div>'
            '<p>Bright, candid, optimistic business lifestyle &mdash; diverse real '
            'people using technology in believable modern environments, shot with '
            'natural light, shallow focus, and room for the brand to speak.</p></div>'
          '<h4 style="margin:6mm 0 1mm">Library structure</h4>%s'
        '</div>'
        '<div style="width:88mm;flex:none">'
          '<h4 style="margin-bottom:3mm">Art direction</h4>%s'
        '</div>'
        '<div style="flex:1">'
          '<h4 style="margin-bottom:2.5mm" class="ok" '
             'style="color:#B0F7BA">Always</h4>'
          '<ul>'
          '<li>People first, genuine positive human moments</li>'
          '<li>Technology in authentic use</li>'
          '<li>Diversity sustained across any set used together</li>'
          '<li>Bright, natural, modern look so images sit together cohesively</li>'
          '<li>Copy space where the image carries overlaid text</li>'
          '<li>Licensed finals only</li>'
          '</ul>'
          '<h4 style="margin:5mm 0 2.5mm">Never</h4>'
          '<ul>'
          '<li class="dash">Stiff, posed or dated corporate-stock clich&eacute;s</li>'
          '<li class="dash">Heavy, inconsistent colour treatments that clash '
          'side by side</li>'
          '<li class="dash">Product or device close-ups with no human context</li>'
          '<li class="dash">Mixing wildly different lighting or moods in one layout</li>'
          '<li class="dash">Watermarked preview comps in production</li>'
          '</ul>'
          '<div class="rule" style="margin:5mm 0"></div>'
          '<h4 style="margin-bottom:2mm">Brand alignment</h4>'
          '<p style="font-size:8pt">Pair imagery with the brand palette and Inter '
          'rather than competing with it. Favour images whose negative space and tone '
          'let brand colour and copy stand out cleanly.</p>'
        '</div>'
      '</div></div>'
      % (head("05 &nbsp;Applications", "Photography"), srows, drows))
    return page(inner, 20)

def p_closing():
    inner = (
      '<div style="position:absolute;top:0;right:0;bottom:0;width:100mm;overflow:hidden">%s</div>'
      '<div style="position:absolute;inset:0;padding:22mm 18mm;display:flex;'
           'flex-direction:column;width:201mm">'
        '<div style="max-width:168mm">'
          '<div class="eyebrow">In summary</div>'
          '<h1 style="font-size:34pt">Dark-first. Amethyst-driven.<br/>'
          'Accessible by default.</h1>'
        '</div>'
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin-top:10mm;max-width:168mm">'
          '<div style="flex:1;background:#292928;border-radius:12px;padding:5mm">'
            '<div style="font-size:8pt;font-weight:600;color:#AC75FF;margin-bottom:2mm">'
            'When in doubt</div>'
            '<p style="font-size:8pt">Amethyst <strong>#AC75FF</strong> on Shadow Heavy '
            '<strong>#1A1919</strong>, set in Inter. Never a tool-default palette.</p>'
          '</div>'
          '<div style="flex:1;background:#292928;border-radius:12px;padding:5mm">'
            '<div style="font-size:8pt;font-weight:600;color:#AC75FF;margin-bottom:2mm">'
            'On light backgrounds</div>'
            '<p style="font-size:8pt">Swap to Accessible Amethyst '
            '<strong>#8A38F5</strong> for type, icons and chart fills.</p>'
          '</div>'
          '<div style="flex:1;background:#292928;border-radius:12px;padding:5mm">'
            '<div style="font-size:8pt;font-weight:600;color:#AC75FF;margin-bottom:2mm">'
            'On Amethyst</div>'
            '<p style="font-size:8pt">All text, logos and icons are Shadow Heavy '
            '<strong>#1A1919</strong>. Crystal Clear is never used there.</p>'
          '</div>'
          '<div style="flex:1;background:#292928;border-radius:12px;padding:5mm">'
            '<div style="font-size:8pt;font-weight:600;color:#AC75FF;margin-bottom:2mm">'
            'Pick the tier first</div>'
            '<p style="font-size:8pt">Tier 1 for internal and analytical work. '
            'Tier 3 only on an explicit customer-facing cue.</p>'
          '</div>'
        '</div>'
        '<div style="flex:1"></div>'
        '<div style="display:flex;justify-content:space-between;align-items:flex-end">'
          '<div>%s'
          '<div class="cap" style="margin-top:4mm;color:#626160">'
          '&copy; 2026 Contentstack. All rights reserved.</div></div>'
          '<div style="text-align:right;max-width:74mm">'
            '<div class="cap" style="color:#626160">Brand Guidelines &middot; '
            'August 2026</div>'
            '<div class="cap" style="color:#484747;margin-top:1mm">Logo, gradient and '
            'photography assets come from the official Contentstack asset library</div>'
          '</div>'
        '</div>'
      '</div>'
      % (asset_gradient("Title_Cover_Gradient.svg",
                        "width:100%;height:100%;display:block"), lockup(9)))
    return page(inner, 21, footer_on=False)
