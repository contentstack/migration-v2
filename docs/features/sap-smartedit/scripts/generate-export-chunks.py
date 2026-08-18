#!/usr/bin/env python3
"""
Generate 13 per-type Groovy export scripts for myContentCatalog, mirroring the
import chunking: one HTTP round-trip per type instead of one giant script
trying to export ~10,570 rows in a single response. Same risk, same fix.

Reuses the EXACT safe()/q()/loc()/refs()/emit() helper pattern already proven
live this session (myContentCatalog-export-v2.groovy) — only the preamble is
duplicated across files (unavoidable: each Groovy execution is independent),
the actual per-type export logic is identical to what already worked.
"""
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), "export-loadtest-chunks")
os.makedirs(OUT_DIR, exist_ok=True)

CATALOG_ID = "myContentCatalog"
CV_VERSION = "Online"
LOCALES = ["en", "de", "fr", "es"]

PREAMBLE = f"""import de.hybris.platform.servicelayer.search.FlexibleSearchQuery

def catalogId = '{CATALOG_ID}'
def cvVersion = '{CV_VERSION}'
def LOCALES = {LOCALES!r}

def catalogVersionService = spring.getBean('catalogVersionService')
def modelService = spring.getBean('modelService')

def cv = catalogVersionService.getCatalogVersion(catalogId, cvVersion)
if (cv == null) {{
  println "ERROR: no CatalogVersion for ${{catalogId}}:${{cvVersion}}"
  return
}}

def safe = {{ Closure c ->
  try {{ def v = c(); return v == null ? '' : v.toString() }} catch (e) {{ return '' }}
}}

def q = {{ String s ->
  if (s == null || s == '') return ''
  def t = s.replace('\\r', ' ').replace('\\n', ' ').replace('"', '""')
  return '"' + t + '"'
}}

def loc = {{ item, String attr, String iso ->
  try {{
    def v = modelService.getAttributeValue(item, attr, new Locale(iso))
    return v == null ? '' : v.toString()
  }} catch (e) {{ return '' }}
}}

def refs = {{ Closure c ->
  try {{
    def coll = c()
    if (coll == null) return ''
    return coll.collect {{ it.uid }}.findAll {{ it }}.join(',')
  }} catch (e) {{ return '' }}
}}

def counts = [:]

def rowsOfExactly = {{ String typeCode ->
  try {{
    def qy = new FlexibleSearchQuery("SELECT {{t.pk}} FROM {{${{typeCode}} AS t}} WHERE {{t.catalogVersion}} = ?cv")
    qy.addQueryParameter('cv', cv)
    return flexibleSearchService.search(qy).result.findAll {{ row ->
      (row.itemtype == null ? '' : row.itemtype.toString()) == typeCode
    }}
  }} catch (e) {{
    counts[typeCode] = "SKIPPED (${{e.class.simpleName}}: ${{e.message}})"
    return []
  }}
}}

def out = new StringBuilder()
out << "\\$catalogId = ${{catalogId}}\\n"
out << "\\$contentCV = catalogVersion(CatalogVersion.catalog(Catalog.id[default=\\$catalogId]),CatalogVersion.version[default=${{cvVersion}}])[default=\\$catalogId:${{cvVersion}}]\\n\\n"

def emit = {{ String typeCode, String header, Closure rowFn ->
  def rows = rowsOfExactly(typeCode)
  if (counts[typeCode] instanceof String) {{ out << "\\n# ---- ${{typeCode}}: ${{counts[typeCode]}} ----\\n"; return }}
  counts[typeCode] = rows.size()
  out << "\\n# ---- ${{typeCode}} (${{rows.size()}}) ----\\n"
  out << "INSERT_UPDATE ${{typeCode}}; \\$contentCV[unique=true]; ${{header}}\\n"
  rows.each {{ r ->
    try {{ out << "                   ;                        ; " + rowFn(r) + "\\n" }}
    catch (e) {{ out << "# SKIPPED ROW (${{e.class.simpleName}}: ${{e.message}})\\n" }}
  }}
}}
"""

FOOTER = """
println out.toString()
println ""
println "# --- row counts ---"
def total = 0
counts.each { k, v ->
  println "# ${k} = ${v}"
  if (v instanceof Integer) total += v
}
println "# TOTAL = ${total}"
"""

# One emit() call per chunk, in the SAME shape already proven live
# (myContentCatalog-export-v2.groovy) — just extracted to one type per file.
EMIT_CALLS = {}

EMIT_CALLS["01-PageTemplate"] = """
emit('PageTemplate', 'uid[unique=true]; name; active',
  { t -> "${safe{t.uid}}; ${q(safe{t.name})}; ${safe{t.active}}" })
"""

EMIT_CALLS["02-Media"] = """
emit('Media', 'code[unique=true]; mime; realfilename',
  { m -> "${safe{m.code}}; ${safe{m.mime}}; ${safe{m.realFileName}}" })
"""

EMIT_CALLS["03-ContentPage"] = """
def pageTitleCols = LOCALES.collect { "title[lang=${it}]" }.join('; ')
emit('ContentPage',
  "uid[unique=true]; name; ${pageTitleCols}; masterTemplate(uid,\\$contentCV); label; defaultPage; approvalStatus(code)",
  { p ->
    def t = LOCALES.collect { q(loc(p, 'title', it)) }.join('; ')
    "${safe{p.uid}}; ${q(safe{p.name})}; ${t}; ${safe{p.masterTemplate?.uid}}; ${safe{p.label}}; ${safe{p.defaultPage}}; ${safe{p.approvalStatus?.code}}"
  })
"""

EMIT_CALLS["04-CMSParagraphComponent"] = """
def contentCols = LOCALES.collect { "content[lang=${it}]" }.join('; ')
emit('CMSParagraphComponent', "&componentRef; uid[unique=true]; name; ${contentCols}",
  { c ->
    def body = LOCALES.collect { q(loc(c, 'content', it)) }.join('; ')
    "${safe{c.uid}}; ${safe{c.uid}}; ${q(safe{c.name})}; ${body}"
  })
"""

EMIT_CALLS["05-CMSTabParagraphComponent"] = """
def contentCols = LOCALES.collect { "content[lang=${it}]" }.join('; ')
emit('CMSTabParagraphComponent', "&componentRef; uid[unique=true]; name; ${contentCols}",
  { c ->
    def body = LOCALES.collect { q(loc(c, 'content', it)) }.join('; ')
    "${safe{c.uid}}; ${safe{c.uid}}; ${q(safe{c.name})}; ${body}"
  })
"""

EMIT_CALLS["06-CMSTabParagraphContainer"] = """
emit('CMSTabParagraphContainer', '&componentRef; uid[unique=true]; name; simpleCMSComponents(uid,$contentCV)',
  { c -> "${safe{c.uid}}; ${safe{c.uid}}; ${q(safe{c.name})}; ${refs{c.simpleCMSComponents}}" })
"""

EMIT_CALLS["07-CMSLinkComponent-CMSNavigationNode-CMSNavigationEntry"] = """
// &componentRef registered AND consumed here, in the SAME script execution —
// same rule that mattered on the import side applies to a faithful export too.
emit('CMSLinkComponent', "&componentRef; uid[unique=true]; name; url; target(code)",
  { c -> "${safe{c.uid}}; ${safe{c.uid}}; ${q(safe{c.name})}; ${safe{c.url}}; ${safe{c.target?.code}}" })

def navTitleCols = LOCALES.collect { "title[lang=${it}]" }.join('; ')
emit('CMSNavigationNode', "&componentRef; uid[unique=true]; ${navTitleCols}; visible",
  { n ->
    def t = LOCALES.collect { q(loc(n, 'title', it)) }.join('; ')
    "${safe{n.uid}}; ${safe{n.uid}}; ${t}; ${safe{n.visible}}"
  })

emit('CMSNavigationEntry', 'uid[unique=true]; navigationNode(uid,$contentCV); item(&componentRef)',
  { e -> "${safe{e.uid}}; ${safe{e.navigationNode?.uid}}; ${safe{e.item?.uid}}" })
"""

EMIT_CALLS["08-CMSImageComponent"] = """
emit('CMSImageComponent', '&componentRef; uid[unique=true]; name; media(code,$contentCV)',
  { c -> "${safe{c.uid}}; ${safe{c.uid}}; ${q(safe{c.name})}; ${safe{c.media?.code}}" })
"""

EMIT_CALLS["09-ContentSlot"] = """
emit('ContentSlot', 'uid[unique=true]; name; active; cmsComponents(uid,$contentCV)',
  { s -> "${safe{s.uid}}; ${q(safe{s.name})}; ${safe{s.active}}; ${refs{s.cmsComponents}}" })
"""

EMIT_CALLS["10-ContentSlotForTemplate"] = """
emit('ContentSlotForTemplate',
  'uid[unique=true]; position[unique=true]; pageTemplate(uid,$contentCV)[unique=true]; contentSlot(uid,$contentCV); allowOverwrite',
  { r -> "${safe{r.uid}}; ${safe{r.position}}; ${safe{r.pageTemplate?.uid}}; ${safe{r.contentSlot?.uid}}; ${safe{r.allowOverwrite}}" })
"""

EMIT_CALLS["11-ContentSlotForPage"] = """
emit('ContentSlotForPage',
  'uid[unique=true]; position[unique=true]; page(uid,$contentCV); contentSlot(uid,$contentCV)',
  { r -> "${safe{r.uid}}; ${safe{r.position}}; ${safe{r.page?.uid}}; ${safe{r.contentSlot?.uid}}" })
"""

for name, emit_call in EMIT_CALLS.items():
    path = os.path.join(OUT_DIR, f"{name}.groovy")
    with open(path, "w", encoding="utf-8") as f:
        f.write(PREAMBLE)
        f.write(emit_call)
        f.write(FOOTER)
    print(f"Wrote {path}")

print()
print(f"{len(EMIT_CALLS)} export scripts written to {OUT_DIR}")
