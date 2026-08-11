const MIGRATION_DATA_CONFIG = {
    DATA :"cmsMigrationData",
    DATA_MAPPER_DIR :"MapperData",
    DATA_MAPPER_CONFIG :"configuration",
    DATA_MAPPER_CONFIG_TREE :"configurationTree",
    DATA_MAPPER_CONFIG_FILE :"configuration.json",
    DATA_MAPPER_CONFIG_TREE_FILE :"configurationTree.json",
    USED_TEMPLATES_FILE :"usedTemplates",
    USED_TEMPLATES_FILE_NAME :"usedTemplates.json",
  
    BACKUP_DATA: "migration-data",
    BACKUP_LOG_DIR: "logs",
    BACKUP_FOLDER_NAME: "import",
    BACKUP_FILE_NAME: "success.log",
  
    LOCALE_DIR_NAME : "locale",
    LOCALE_FILE_NAME : "locales.json",
    LOCALE_MASTER_LOCALE : "master-locale.json",
    LOCALE_CF_LANGUAGE : "language.json",
  
    CONTENT_TYPES_DIR_NAME : "content_types",
    CONTENT_TYPES_FILE_NAME : "contenttype.json",
    CONTENT_TYPES_MASTER_FILE : "contenttypes.json",
    CONTENT_TYPES_SCHEMA_FILE : "schema.json",
  
    REFERENCES_DIR_NAME : "reference",
    REFERENCES_FILE_NAME : "reference.json",
  
    RTE_REFERENCES_DIR_NAME : "rteReference",
    RTE_REFERENCES_FILE_NAME : "rteReference.json",
  
    ASSETS_DIR_NAME : "assets",
    ASSETS_FILE_NAME : "assets.json",
    ASSETS_SCHEMA_FILE : "index.json",
    ASSETS_FAILED_FILE : "cs_failed.json",
    ASSETS_METADATA_FILE :"metadata.json",
  
    ENTRIES_DIR_NAME : "entries",
    ENTRIES_MASTER_FILE : "index.json",
  
    
    GLOBAL_FIELDS_DIR_NAME : "global_fields",
    GLOBAL_FIELDS_FILE: "globalfields",
    GLOBAL_FIELDS_FILE_NAME : "globalfields.json",
    EXPORT_INFO_FILE: "export-info.json"
  }

// Tuning for the layout/renderings feature (libs/observedRenderings.js).
//
// Blocks are keyed by datasource template rather than by rendering: on a real package
// 219 distinct renderings on one page template resolve to 29 datasource templates, and
// those templates are already migrated content types. The thresholds below trim that
// further to the templates that actually carry the page.
const RENDERING_CONFIG = {
  // Field uid for the component list on a page content type.
  COMPONENTS_FIELD_UID: 'components',
  // Minimum share of a page template's placements before a datasource template earns
  // its own block.
  COVERAGE_THRESHOLD: 0.01,
  // ...and it must appear on at least this many pages, so a template used heavily on a
  // single page doesn't become schema for everyone.
  MIN_PAGES: 2,
  // Hard ceiling regardless of thresholds; the remainder goes to the fallback block.
  MAX_BLOCKS_PER_TEMPLATE: 25,
  // Shared block carrying every placement without a dedicated block, so the long tail
  // is migrated as data rather than dropped.
  FALLBACK_BLOCK_UID: 'component'
};



// Sitecore prefixes its own fields with `__`. Most are audit/workflow/UI plumbing we
// don't migrate, but a handful hold real authored content and must be mapped like any
// user field. Allowlist rather than blocklist: an unknown `__` field from another
// package defaults to skipped instead of silently becoming schema.
//
// Deliberately excluded even though they hold values:
//   __sortorder        - duplicated as the item's `sortorder` attribute; read that instead
//   __renderings       - layout XML. Not a field: it becomes the `components` modular
//                        blocks field, built by libs/observedRenderings.js and written
//                        on the entry side by api/src/utils/rendering-composer.utils.ts.
//                        It must stay out of this allowlist so it is never also emitted
//                        as an ordinary text field.
//   __final renderings - same
//   __base template    - already special-cased into global fields in contenttypes.js
const SITECORE_SYSTEM_FIELD_ALLOWLIST = [
  '__icon',
  '__display name',
  '__short description',
  '__long description',
  '__thumbnail',
  '__help link',
  '__style'
];

// True when a Sitecore field key should be dropped from the mapping: it's a `__` system
// field and not one of the allowlisted content-bearing ones. Note this checks the `__`
// *prefix* — a user field merely containing a double underscore is kept.
const isSkippableSystemField = (key) => {
  if (typeof key !== 'string') return false;
  if (!key.startsWith('__')) return false;
  return !SITECORE_SYSTEM_FIELD_ALLOWLIST.includes(key.toLowerCase());
};

module.exports = {
  MIGRATION_DATA_CONFIG,
  RENDERING_CONFIG,
  SITECORE_SYSTEM_FIELD_ALLOWLIST,
  isSkippableSystemField
};
