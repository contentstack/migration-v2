import de.hybris.platform.servicelayer.search.FlexibleSearchQuery

// Quick row-count check across all 13 supported types for myContentCatalog,
// to confirm the 10k load-test rows are actually there before spending an
// export cycle on it. Read-only.

def catalogVersionService = spring.getBean('catalogVersionService')
def cv = catalogVersionService.getCatalogVersion('myContentCatalog', 'Online')
if (cv == null) { println "ERROR: no CatalogVersion"; return }

def types = [
  'PageTemplate', 'Media', 'ContentPage', 'CMSParagraphComponent',
  'CMSTabParagraphComponent', 'CMSTabParagraphContainer', 'CMSLinkComponent',
  'CMSImageComponent', 'CMSNavigationNode', 'CMSNavigationEntry',
  'ContentSlot', 'ContentSlotForTemplate', 'ContentSlotForPage',
]

def total = 0
types.each { t ->
  try {
    def q = new FlexibleSearchQuery("SELECT {x.pk} FROM {${t} AS x} WHERE {x.catalogVersion} = ?cv")
    q.addQueryParameter('cv', cv)
    def n = flexibleSearchService.search(q).result.findAll { row ->
      (row.itemtype == null ? '' : row.itemtype.toString()) == t
    }.size()
    println "${t.padRight(28)} ${n}"
    total += n
  } catch (e) {
    println "${t.padRight(28)} ERROR: ${e.message}"
  }
}
println ""
println "TOTAL: ${total}  (expect ~10,570 = 10,000 load-test + ~570 pre-existing)"
