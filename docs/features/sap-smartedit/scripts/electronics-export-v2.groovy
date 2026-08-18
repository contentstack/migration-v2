import de.hybris.platform.servicelayer.search.FlexibleSearchQuery

// ---------------------------------------------------------------------------
// SCALE TEST: export the REAL, official electronicsContentCatalog (Spartacus
// sample data) at full size — 753 rows across our 13 supported types, per live
// discovery (discover-electronics-scope.groovy). This is genuine SAP content at
// real customer-like scale, not synthetic data, standing in for a real customer
// catalog until one actually arrives.
//
// Deliberately limited to the 13 types the connector currently supports — the
// discovery scan found 42 more real types present in this catalog (some with
// real volume: JspIncludeComponent 44, DocumentPage/Template 22 each, banner
// components 20/11) that this connector has never been built to handle. Adding
// them is separate, larger follow-up work; this export answers a narrower
// question first: does the EXISTING, working pipeline hold up at ~3x our
// previous largest test (282 rows), on real data?
//
// Same generic emit()/rowsOfExactly() machinery as
// myContentCatalog-export-v2.groovy (which superseded the older, flattened
// electronics-export.groovy from earlier in the session) — only
// catalogId/cvVersion/LOCALES differ.
// Run in HAC -> Console -> Scripting Languages (groovy). Read-only.
// ---------------------------------------------------------------------------

def catalogId = 'electronicsContentCatalog'
def cvVersion = 'Staged'
def LOCALES = ['en', 'de']

def catalogVersionService = spring.getBean('catalogVersionService')
def modelService = spring.getBean('modelService')

def cv = catalogVersionService.getCatalogVersion(catalogId, cvVersion)
if (cv == null) {
  println "ERROR: no CatalogVersion for ${catalogId}:${cvVersion}"
  return
}

// ---- helpers ---------------------------------------------------------------
def safe = { Closure c ->
  try { def v = c(); return v == null ? '' : v.toString() } catch (e) { return '' }
}

def q = { String s ->
  if (s == null || s == '') return ''
  def t = s.replace('\r', ' ').replace('\n', ' ').replace('"', '""')
  return '"' + t + '"'
}

def loc = { item, String attr, String iso ->
  try {
    def v = modelService.getAttributeValue(item, attr, new Locale(iso))
    return v == null ? '' : v.toString()
  } catch (e) { return '' }
}

def refs = { Closure c ->
  try {
    def coll = c()
    if (coll == null) return ''
    return coll.collect { it.uid }.findAll { it }.join(',')
  } catch (e) { return '' }
}

def counts = [:]

def rowsOfExactly = { String typeCode ->
  try {
    def qy = new FlexibleSearchQuery("SELECT {t.pk} FROM {${typeCode} AS t} WHERE {t.catalogVersion} = ?cv")
    qy.addQueryParameter('cv', cv)
    return flexibleSearchService.search(qy).result.findAll { row ->
      (row.itemtype == null ? '' : row.itemtype.toString()) == typeCode
    }
  } catch (e) {
    counts[typeCode] = "SKIPPED (${e.class.simpleName}: ${e.message})"
    return []
  }
}

def out = new StringBuilder()
out << "# =============================================================================\n"
out << "# SCALE TEST — GENUINE LIVE EXPORT — ${catalogId}:${cvVersion}\n"
out << "# Real official SAP sample data (Spartacus electronics), ~753 rows across the\n"
out << "# 13 connector-supported types. See discover-electronics-scope.groovy for the\n"
out << "# full 93-type inventory this catalog actually contains.\n"
out << "# =============================================================================\n\n"
out << "\$catalogId = ${catalogId}\n"
out << "\$contentCV = catalogVersion(CatalogVersion.catalog(Catalog.id[default=\$catalogId]),CatalogVersion.version[default=${cvVersion}])[default=\$catalogId:${cvVersion}]\n\n"

def emit = { String typeCode, String header, Closure rowFn ->
  def rows = rowsOfExactly(typeCode)
  if (counts[typeCode] instanceof String) { out << "\n# ---- ${typeCode}: ${counts[typeCode]} ----\n"; return }
  counts[typeCode] = rows.size()
  out << "\n# ---- ${typeCode} (${rows.size()}) ----\n"
  out << "INSERT_UPDATE ${typeCode}; \$contentCV[unique=true]; ${header}\n"
  rows.each { r ->
    try { out << "                   ;                        ; " + rowFn(r) + "\n" }
    catch (e) { out << "# SKIPPED ROW (${e.class.simpleName}: ${e.message})\n" }
  }
}

emit('PageTemplate', 'uid[unique=true]; name; active',
  { t -> "${safe{t.uid}}; ${q(safe{t.name})}; ${safe{t.active}}" })

emit('Media', 'code[unique=true]; mime; realfilename',
  { m -> "${safe{m.code}}; ${safe{m.mime}}; ${safe{m.realFileName}}" })

def pageTitleCols = LOCALES.collect { "title[lang=${it}]" }.join('; ')
emit('ContentPage',
  "uid[unique=true]; name; ${pageTitleCols}; masterTemplate(uid,\$contentCV); label; defaultPage; approvalStatus(code)",
  { p ->
    def t = LOCALES.collect { q(loc(p, 'title', it)) }.join('; ')
    "${safe{p.uid}}; ${q(safe{p.name})}; ${t}; ${safe{p.masterTemplate?.uid}}; ${safe{p.label}}; ${safe{p.defaultPage}}; ${safe{p.approvalStatus?.code}}"
  })

emit('ContentSlot', 'uid[unique=true]; name; active; cmsComponents(uid,$contentCV)',
  { s -> "${safe{s.uid}}; ${q(safe{s.name})}; ${safe{s.active}}; ${refs{s.cmsComponents}}" })

def contentCols = LOCALES.collect { "content[lang=${it}]" }.join('; ')

emit('CMSParagraphComponent', "&componentRef; uid[unique=true]; name; ${contentCols}",
  { c ->
    def body = LOCALES.collect { q(loc(c, 'content', it)) }.join('; ')
    "${safe{c.uid}}; ${safe{c.uid}}; ${q(safe{c.name})}; ${body}"
  })

emit('CMSTabParagraphComponent', "&componentRef; uid[unique=true]; name; ${contentCols}",
  { c ->
    def body = LOCALES.collect { q(loc(c, 'content', it)) }.join('; ')
    "${safe{c.uid}}; ${safe{c.uid}}; ${q(safe{c.name})}; ${body}"
  })

emit('CMSTabParagraphContainer', '&componentRef; uid[unique=true]; name; simpleCMSComponents(uid,$contentCV)',
  { c -> "${safe{c.uid}}; ${safe{c.uid}}; ${q(safe{c.name})}; ${refs{c.simpleCMSComponents}}" })

emit('CMSLinkComponent', "&componentRef; uid[unique=true]; name; url; target(code)",
  { c -> "${safe{c.uid}}; ${safe{c.uid}}; ${q(safe{c.name})}; ${safe{c.url}}; ${safe{c.target?.code}}" })

emit('CMSImageComponent', '&componentRef; uid[unique=true]; name; media(code,$contentCV)',
  { c -> "${safe{c.uid}}; ${safe{c.uid}}; ${q(safe{c.name})}; ${safe{c.media?.code}}" })

def navTitleCols = LOCALES.collect { "title[lang=${it}]" }.join('; ')
emit('CMSNavigationNode', "&componentRef; uid[unique=true]; ${navTitleCols}; visible",
  { n ->
    def t = LOCALES.collect { q(loc(n, 'title', it)) }.join('; ')
    "${safe{n.uid}}; ${safe{n.uid}}; ${t}; ${safe{n.visible}}"
  })

emit('CMSNavigationEntry', 'uid[unique=true]; navigationNode(uid,$contentCV); item(&componentRef)',
  { e -> "${safe{e.uid}}; ${safe{e.navigationNode?.uid}}; ${safe{e.item?.uid}}" })

emit('ContentSlotForTemplate',
  'uid[unique=true]; position[unique=true]; pageTemplate(uid,$contentCV)[unique=true]; contentSlot(uid,$contentCV); allowOverwrite',
  { r -> "${safe{r.uid}}; ${safe{r.position}}; ${safe{r.pageTemplate?.uid}}; ${safe{r.contentSlot?.uid}}; ${safe{r.allowOverwrite}}" })

emit('ContentSlotForPage',
  'uid[unique=true]; position[unique=true]; page(uid,$contentCV); contentSlot(uid,$contentCV)',
  { r -> "${safe{r.uid}}; ${safe{r.position}}; ${safe{r.page?.uid}}; ${safe{r.contentSlot?.uid}}" })

println out.toString()
println ""
println "# --- row counts ---"
def total = 0
counts.each { k, v ->
  println "# ${k} = ${v}"
  if (v instanceof Integer) total += v
}
println "# TOTAL = ${total}"
