export const parseXFPath = (path: string): boolean => {
  // Check if path contains "experience-fragments" or "experiencefragment"
  return /(experience-fragments|experiencefragment)/.test(path);
};


export function isContainerComponent(path: string) {
  // Check for all container patterns and return the type
  const patterns = {
    responsivegrid: /components\/responsivegrid/,
    container: /components\/container/,
    parsys: /parsys/,
    layoutContainer: /components\/layout-container/
  };

  for (const [type, pattern] of Object.entries(patterns)) {
    if (pattern.test(path)) {
      return {
        isContainer: true,
        type: type,
        path: path
      };
    }
  }

  return {
    isContainer: false,
    type: null,
    path: path
  };
}


/**
 * Quick Experience Fragment Identifier
 * Checks if JSON data represents an Experience Fragment template
 */

export function isExperienceFragment(data: any) {
  if (data?.templateType && data[':type']) {
    // Check templateType starts with 'xf-'
    const hasXfTemplate = data?.templateType?.startsWith('xf-');

    // Check :type contains 'components/xfpage'
    const hasXfComponent = data[':type']?.includes('components/xfpage');

    // Return analysis
    return {
      isXF: hasXfTemplate || hasXfComponent,
      confidence: (hasXfTemplate && hasXfComponent) ? 'high'
        : (hasXfTemplate || hasXfComponent) ? 'medium' : 'low',
      indicators: {
        templateType: hasXfTemplate ? data.templateType : null,
        componentType: hasXfComponent ? data[':type'] : null,
      }
    };
  }
  return null;
}


