"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseXFPath = void 0;
exports.isContainerComponent = isContainerComponent;
exports.isExperienceFragment = isExperienceFragment;
const parseXFPath = (path) => {
    // Check if path contains "experience-fragments" or "experiencefragment"
    return /(experience-fragments|experiencefragment)/.test(path);
};
exports.parseXFPath = parseXFPath;
function isContainerComponent(path) {
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
function isExperienceFragment(data) {
    var _a, _b;
    if ((data === null || data === void 0 ? void 0 : data.templateType) && data[':type']) {
        // Check templateType starts with 'xf-'
        const hasXfTemplate = (_a = data === null || data === void 0 ? void 0 : data.templateType) === null || _a === void 0 ? void 0 : _a.startsWith('xf-');
        // Check :type contains 'components/xfpage'
        const hasXfComponent = (_b = data[':type']) === null || _b === void 0 ? void 0 : _b.includes('components/xfpage');
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
