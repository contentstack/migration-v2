# Artifact → PDF

Turns the **WinnDixie Migration Architecture** artifact into
`docs/WinnDixie-Migration-Architecture.pdf` (38 pages, A4 portrait).

The artifact's own content and editorial theme are kept verbatim — Newsreader
display, Public Sans body, JetBrains Mono for code, red accent. Only the screen
shell is replaced: the sticky sidebar and two-column grid become a cover page, a
contents page, and a single flowing column with a running footer and page numbers.

## Pipeline

```bash
cd docs/artifact-to-pdf
pip install fonttools brotli playwright pypdf pypdfium2 numpy
python3 fonts/prep.py     # fetch + instance the three families -> fonts/report-fonts.css
python3 convert.py        # artifact HTML -> report-print.html
python3 render.py         # report-print.html -> ../WinnDixie-Migration-Architecture.pdf
python3 audit.py          # page count + per-page blank-space report
```

`convert.py` reads the artifact HTML from the path in its `ARTIFACT` constant.

## Things that needed handling

**Mermaid diagrams (18).** The artifact bundles its own mermaid runtime, which is
carried over so the diagrams render offline. They render asynchronously, so
`render.py` waits for all 18 `<svg>`s before printing rather than using a fixed
delay.

**Diagram labels were losing their line breaks.** The mermaid sources contain
literal `<br/>` tags, which the browser parses as real elements inside `<pre>`.
The runtime reads `pre.textContent`, where a `<br>` element contributes nothing,
so `master DB<br/>every version` arrived as `master DBevery version` — visible in
the artifact on screen too, not something the conversion introduced. `convert.py`
escapes the tags so they survive as text and relaxes `securityLevel` to `loose`
so mermaid turns them back into line breaks; all 84 breaks are restored. The only
markup in these labels is `<br/>`.

**Fonts.** All three families are variable, and Chromium's print pipeline emits
variable fonts as Type3 glyph outlines, which loses the named face and inflates
the file. `fonts/prep.py` instantiates the eight needed static weights from the
complete files in the `google/fonts` repo — not the Google Fonts API's Latin
subsets, which omit `∅` (U+2205) and `≤` (U+2264) that the document uses. `→`
(U+2192) is in none of these typefaces and falls back to a system sans/serif, as
it does in the artifact; Chromium embeds a subset of the fallback, so the PDF
stays self-contained.

The footer template is rendered by Chromium in an isolated document that does not
inherit page styles, so `render.py` inlines the Public Sans face into the template
as well — otherwise the page numbers alone fall back to DejaVu Sans.

**Pagination.** Each section's heading, intro and diagram are wrapped in a
keep-together block. Forcing a page break before every section instead left about
24 near-empty tail pages; letting everything flow freely orphaned headings above
diagrams that no longer fit. Diagrams are capped at 205mm — enough that the four
very tall, narrow flowcharts stay legible at roughly 62%. A 165mm cap saves three
pages but shrinks their labels to about 6pt.

`audit.py` rasterises every page and reports how much of the text block carries
ink, which is how the pagination options above were compared. The 12 pages it
flags are section tails and the contents page, not layout faults.
