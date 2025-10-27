import fs from 'fs';
import path from 'path';
import { IReadFiles } from "./types/index.interface";
import { MergeStrategy } from "./types/index.interface";
import { v4 as uuidv4 } from "uuid";


/**
 * Reads a file from the given file path and parses its content as JSON.
 * 
 * @param {string} filePath - The path to the file to be read.
 * @returns {Promise<any>} - A promise that resolves to the parsed JSON content of the file.
 * @throws {Error} - Throws an error if the file content is empty, undefined, or invalid JSON.
 */

export const readFiles: IReadFiles = async (filePath: string) => {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
  } catch {
    console.info(`File does not exist: ${filePath}`);
    return null;
  }
  const fileData = await fs.promises.readFile(filePath, 'utf8')
  if (!fileData) {
    console.info('File content is empty or undefined');
    return null;
  }
  if (typeof fileData === 'string') {
    return JSON.parse(fileData);
  }
  return fileData;
}



/**
 * Extracts the last segment of a component path from a given string.
 *
 * Searches for a substring that matches the pattern `components/...` and returns
 * the last path segment after the final `/`. If no such pattern is found, returns `null`.
 *
 * @param line - The input string to search for a component path.
 * @returns The last segment of the matched component path, or `null` if no match is found.
 */

export const extractComponentPath = (line: string): string | null => {
  const match = line.match(/components(?:\/[\w-]+)+/);
  if (!match) return line;

  // Get the last element after the last '/'
  const parts = match[0].split('/');
  return parts[parts.length - 1];
}


/*
 * Interface for merge strategy implementations
 * Following Interface Segregation Principle (ISP)
 */
export class SchemaComponentMergeStrategy implements MergeStrategy {
  canMerge(key: string, sourceValue: any, targetValue: any): boolean {
    return !!sourceValue?.convertedSchema && !!targetValue?.convertedSchema;
  }

  merge(key: string, sourceValue: any, targetValue: any): any {
    // Keep the most complete schema definition
    if (Object.keys(sourceValue.convertedSchema).length >
      Object.keys(targetValue.convertedSchema).length) {
      return sourceValue;
    }
    return targetValue;
  }
}

/**
 * Default strategy for merging components
 */
export class DefaultMergeStrategy implements MergeStrategy {
  canMerge(): boolean {
    return true; // This is the fallback strategy
  }

  merge(sourceValue: any): any {
    return sourceValue; // Default to taking the newer value
  }
}

/**
 * Component merger following SOLID principles
 * Open/Closed Principle (OCP) - open for extension with new strategies
 * Dependency Inversion Principle (DIP) - depends on abstractions not implementations
 */
export class ComponentMerger {
  private strategies: MergeStrategy[];

  constructor(strategies?: MergeStrategy[]) {
    // Default strategies if none provided
    this.strategies = strategies || [
      new SchemaComponentMergeStrategy(),
      new DefaultMergeStrategy()
    ];
  }

  /**
   * Add a new merge strategy
   * OCP - extend functionality without modifying existing code
   */
  addStrategy(strategy: MergeStrategy): void {
    this.strategies.push(strategy);
  }

  /**
   * Find the appropriate strategy for merging
   */
  private findStrategy(key: string, sourceValue: any, targetValue: any): MergeStrategy {
    return this.strategies.find(strategy =>
      strategy.canMerge(key, sourceValue, targetValue)
    ) || this.strategies[this.strategies.length - 1]; // Default to last strategy
  }

  /**
   * Merge a single key between two objects
   * SRP - focused responsibility
   */
  private mergeKey(key: string, sourceValue: any, targetObject: any): void {
    if (!targetObject[key]) {
      // Key doesn't exist in target, simply add it
      targetObject[key] = sourceValue;
    } else {
      // Find and apply the appropriate merge strategy
      const strategy = this.findStrategy(key, sourceValue, targetObject[key]);
      targetObject[key] = strategy.merge(key, sourceValue, targetObject[key]);
    }
  }

  /**
   * Merge objects together
   * Public API for this class
   */
  merge(objects: Record<string, any>[]): Record<string, any> {
    if (!objects.length) return {};

    const result: Record<string, any> = {};

    objects.forEach(obj => {
      Object.keys(obj).forEach(key => {
        this.mergeKey(key, obj[key], result);
      });
    });

    return result;
  }
}

/**
 * Factory function to create a component merger
 * Makes using the class easier without exposing implementation details
 */
export function createComponentMerger(strategies?: MergeStrategy[]): ComponentMerger {
  return new ComponentMerger(strategies);
}

/**
 * Convenience function that wraps the merger for simple use cases
 */
export function mergeComponentObjects(objects: Record<string, any>[]): Record<string, any> {
  const merger = createComponentMerger();
  return merger.merge(objects);
}



/**
 * Writes the given data to a JSON file at the specified path.
 * Ensures the directory exists before writing.
 * @param data - The data to write.
 * @param filePath - The file path to write to.
 */
export async function writeJsonFile(
  data: any,
  filePath: string = './contentstackComponents.json'
): Promise<void> {
  const dir = path.dirname(filePath);
  try {
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    throw new Error(`Failed to write JSON file: ${error}`);
  }
}

/**
 * Checks if the provided path is an image type (jpeg, jpg, png, gif, webp, svg).
 * @param path - The string path to check.
 * @returns True if the path is an image, false otherwise.
 */
export function isImageType(path: string): boolean {
  return /\.(jpeg|jpg|png|gif|webp|svg)$/i.test(path);
}


export const uidCorrector = (uid: string) => {
  // Remove leading colon if present (e.g., ':items' becomes 'items')
  let newUid = uid.replace(/^:/, '');

  // Insert underscore before uppercase letters, then lowercase everything
  newUid = newUid.replace(/([a-z0-9])([A-Z])/g, '$1_$2');

  // Replace spaces, hyphens, and colons with underscores
  newUid = newUid.replace(/[ :-]/g, '_');

  // Remove all '$' characters
  newUid = newUid.replace(/\$/g, '');

  // Remove any character not alphanumeric or underscore
  newUid = newUid.replace(/[^a-zA-Z0-9_]/g, '');

  // Ensure starts with an alphabet, else prefix with 'a'
  if (!/^[a-zA-Z]/.test(newUid)) {
    newUid = 'a' + newUid;
  }

  return newUid.toLowerCase();
};

export const isUrlPath = (str: string) => /^\/[a-zA-Z0-9\-/.]+$/.test(str);

export const isHtmlString = (str: string): boolean => /<[a-z][\s\S]*>/i.test(str);


export function findComponentByType(contentstackComponents: any, type: string, exclude: string[] = ['nt:folder']) {
  return Object.entries(contentstackComponents ?? {}).find(
    ([, csValue]: any) => {
      const csType = (csValue as { [key: string]: any })['type'];
      return csType === type && !exclude.includes(csType);
    }
  );
}


export function countComponentTypes(component: any, result: Record<string, number> = {}) {
  if (!component || typeof component !== "object") return result;

  // Check for ':type' at current level
  const typeField = component[":type"]?.value;
  if (typeField) {
    result[typeField] = (result[typeField] || 0) + 1;
  }

  // Recursively check nested properties
  for (const key in component) {
    if (component[key] && typeof component[key] === "object") {
      countComponentTypes(component[key], result);
    }
  }

  return result;
}


export function findFirstComponentByType(schema: Record<string, any>, type: string): any | null {
  if (!schema || typeof schema !== "object") return null;

  // Check at current level
  if (schema[":type"]?.value === type) {
    return schema;
  }

  // Recursively check nested properties
  for (const key in schema) {
    if (schema[key] && typeof schema[key] === "object") {
      const found = findFirstComponentByType(schema[key], type);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Converts kebab-case or snake_case to a human-readable title.
 * Example: "page-content-full-width" => "Page content full width"
 */
export function toHumanTitle(str: string): string {
  return str
    .replace(/[-_]+/g, ' ')         // Replace - and _ with space
    .replace(/\s+/g, ' ')           // Normalize spaces
    .trim()                         // Remove leading/trailing spaces
    .replace(/^./, c => c.toUpperCase()); // Capitalize first letter
}

export function createContentTypeObject({
  otherCmsTitle,
  otherCmsUid,
  fieldMapping,
  type = "content_type",
  status = 1,
  isUpdated = false
}: {
  otherCmsTitle: string;
  otherCmsUid: string;
  fieldMapping: any[];
  type?: string;
  status?: number;
  isUpdated?: boolean;
}) {
  return {
    id: uuidv4(),
    status,
    otherCmsTitle: toHumanTitle(otherCmsTitle),
    otherCmsUid,
    isUpdated,
    contentstackTitle: toHumanTitle(otherCmsTitle),
    contentstackUid: uidCorrector(otherCmsUid),
    type,
    fieldMapping,
  };
}


/**
 * Ensures a field with the given UID exists in the schema array.
 * If not present, prepends the provided field config.
 */
export function ensureField(
  mainSchema: any[],
  fieldConfig: Record<string, any>,
  fieldUid: string
) {
  const found = mainSchema?.some(
    (item) => item?.contentstackFieldUid?.toLowerCase?.() === fieldUid.toLowerCase()
  );
  if (!found) {
    mainSchema.unshift(fieldConfig);
  }
}