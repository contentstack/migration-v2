import de.hybris.platform.servicelayer.search.FlexibleSearchQuery

// Discover the REAL scope of electronicsContentCatalog before exporting it at
// scale: every concrete CMS item type present, with its true row count. This is
// how we find out which types our connector has never seen — the exact blind
// spot flagged as untested. Read-only.

def catalogId = 'electronicsContentCatalog'
def cvVersion = 'Staged' // Staged usually carries more content than Online; adjust if needed.

def catalogVersionService = spring.getBean('catalogVersionService')
def flexibleSearchService = spring.getBean('flexibleSearchService')
def typeManager = de.hybris.platform.jalo.JaloSession.getCurrentSession().getTypeManager()

def cv = catalogVersionService.getCatalogVersion(catalogId, cvVersion)
if (cv == null) {
  println "ERROR: no CatalogVersion for ${catalogId}:${cvVersion}"
  return
}
println "catalogVersion pk = ${cv.pk}"
println ""

// Every concrete (non-abstract) subtype of CMSItem — the real universe of CMS
// content types this catalog could contain, not just the 13 our connector knows.
def cmsItemType = typeManager.getComposedType('CMSItem')
def candidateTypes = ([cmsItemType] + cmsItemType.getAllSubTypes())
  .findAll { !it.isAbstract() }
  .collect { it.getCode() }
  .unique()
  .sort()

println "=== ${candidateTypes.size()} concrete CMSItem subtypes installed; checking row counts ==="
def present = []
candidateTypes.each { typeCode ->
  try {
    def q = new FlexibleSearchQuery("SELECT {t.pk} FROM {${typeCode} AS t} WHERE {t.catalogVersion} = ?cv")
    q.addQueryParameter('cv', cv)
    def count = flexibleSearchService.search(q).result.size()
    if (count > 0) present << [type: typeCode, count: count]
  } catch (e) {
    // Type exists in the model but isn't catalog-version-scoped, or another
    // structural mismatch — skip rather than fail the whole scan.
  }
}

present.sort { -it.count }
println ""
println "=== types PRESENT in ${catalogId}:${cvVersion}, by row count ==="
def total = 0
present.each { row ->
  println "  ${row.type.padRight(40)} ${row.count}"
  total += row.count
}
println ""
println "TOTAL CMS rows: ${total}"
println ""

// Also check Media separately, since it isn't a CMSItem.
def mq = new FlexibleSearchQuery("SELECT {m.pk} FROM {Media AS m} WHERE {m.catalogVersion} = ?cv")
mq.addQueryParameter('cv', cv)
println "Media rows: ${flexibleSearchService.search(mq).result.size()}"
