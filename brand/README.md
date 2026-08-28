# Contentstack Brand Guidelines (PDF)

`Contentstack-Brand-Guidelines.pdf` — a 21-page, A4-landscape reference for
Contentstack's visual identity, generated from the `contentstack-brand-guidelines`
skill. It covers the colour system, typography, logo rules, iconography, chart and
data-visualisation defaults, and the photography art direction.

## What the document is built from

Every value in the PDF comes from the skill's own reference files — no colours,
sizes or rules were invented:

| Section | Source |
|---|---|
| Ethos, application tiers, chart defaults | `SKILL.md` |
| Core / secondary / grayscale, gradients, accessibility, utility families | `references/colors.md` |
| Typefaces, type styles, slide type scale | `references/typography.md` |
| Lockup, approved colour combinations, clear space, co-branding | `references/logo-guidelines.md` |
| File formats, avatars, favicon | `references/logo-assets.md` |
| Marketing and utility icons | `references/icons.md` |
| Container spec, series order, complexity ladder | `references/charts-and-infographics.md` |
| Library structure, art direction, licensing | `references/photography.md` |

The logo lockup, logomark and gradient compositions are the skill's official
`assets/*.svg` files, inlined unmodified — resized via CSS only, with the gradient
stops untouched. Logo fills are swapped solely to render the four approved colour
combinations documented on page 14.

## Brand conformance

- **Tier 3** treatment (dark surfaces, full palette, gradients, logo) — the document
  is a customer- and team-facing brand piece.
- **Inter only.** Tercia is never used in generated output; the PDF embeds five
  static Inter instances and nothing else.
- `#AC75FF` on dark, `#8A38F5` on light, `#1A1919` on Amethyst — applied throughout.
- Gradients are scaled proportionally, never stretched, and never applied to text.

`→`, `✓` and `✗` are drawn as inline SVG because they fall outside Inter's Latin
subset; letting them fall back to a system font would have broken the Inter-only rule.

## Rebuilding

```bash
cd brand/generator
pip install fonttools brotli            # font tooling
python3 make_fonts.py                   # fetch Inter, emit ../fonts/inter-static.css
python3 build.py                        # assemble brand-guidelines.html
/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  --headless --disable-gpu --no-sandbox --no-pdf-header-footer \
  --virtual-time-budget=25000 \
  --print-to-pdf=../Contentstack-Brand-Guidelines.pdf \
  "file://$PWD/brand-guidelines.html"
python3 overflow_check.py               # assert no page overflows its footer
```

`make_fonts.py` regenerates the embedded font CSS, so no font binaries are committed.
`overflow_check.py` measures every text node against the footer on each page and
exits with a per-page report — run it after any content edit.
