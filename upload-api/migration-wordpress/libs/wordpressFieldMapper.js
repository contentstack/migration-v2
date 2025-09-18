const { getOrgPlanLimitsByProject } = require('../../build/utils/orgPlanLimits');

/**
 * Example WordPress field mapper that uses dynamic org plan limits
 * @param {Array} wordpressFields - Array of WordPress field data (ACF, custom fields, etc.)
 * @param {string} projectId - Project ID to fetch org limits
 * @returns {Array} Mapped fields with dynamic limits applied
 */
const mapWordpressFields = (wordpressFields, projectId) => {
  // Get dynamic limits from org plan
  const orgLimits = getOrgPlanLimitsByProject(projectId, 'wordpress');
  const { referenceFieldLimit, jsonRteLimit, orgUid } = orgLimits;
  
  console.log(`🎯 WordPress Mapper - Using dynamic limits:`, {
    projectId,
    orgUid,
    referenceFieldLimit,
    jsonRteLimit,
    source: orgUid ? 'local-config' : 'defaults'
  });

  return wordpressFields.map(field => {
    // Apply dynamic limits based on field type
    switch (field.type) {
      case 'relationship':
      case 'post_object':
      case 'page_link':
        // Apply reference field limits for relationship fields
        if (field.post_type && Array.isArray(field.post_type) && field.post_type.length > referenceFieldLimit) {
          console.log(`🔗 WordPress field "${field.name}" limited to ${referenceFieldLimit} post types`);
          field.post_type = field.post_type.slice(0, referenceFieldLimit);
        }
        break;
        
      case 'wysiwyg':
      case 'textarea':
        // Apply JSON RTE limits for rich text fields
        if (field.allowed_blocks && field.allowed_blocks.length > jsonRteLimit) {
          console.log(`📝 WordPress WYSIWYG field "${field.name}" limited to ${jsonRteLimit} allowed blocks`);
          field.allowed_blocks = field.allowed_blocks.slice(0, jsonRteLimit);
        }
        break;
        
      case 'repeater':
      case 'flexible_content':
        // Apply limits to sub-fields in complex field types
        if (field.sub_fields && field.sub_fields.length > referenceFieldLimit) {
          console.log(`🔄 WordPress repeater field "${field.name}" limited to ${referenceFieldLimit} sub-fields`);
          field.sub_fields = field.sub_fields.slice(0, referenceFieldLimit);
        }
        break;
        
      default:
        // No limits applied for other field types
        break;
    }
    
    return field;
  });
};

module.exports = { mapWordpressFields };
