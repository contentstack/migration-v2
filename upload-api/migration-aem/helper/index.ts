import fs from 'fs';
import path from 'path';
import { IReadFiles } from "./types/index.interface";
import { MergeStrategy } from "./types/index.interface"


/**
 * Reads a file from the given file path and parses its content as JSON.
 * 
 * @param {string} filePath - The path to the file to be read.
 * @returns {Promise<any>} - A promise that resolves to the parsed JSON content of the file.
 * @throws {Error} - Throws an error if the file content is empty, undefined, or invalid JSON.
 */

export const readFiles: IReadFiles = async (filePath: string) => {
  const fileData = await fs.promises.readFile(filePath, 'utf8')
  if (!fileData) {
    throw new Error('File content is empty or undefined');
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
  // Replace spaces, hyphens, and colons with underscores, then lowercase
  const newUid = uid.replace(/[ :-]/g, '_').toLowerCase();
  // Remove all '$' characters
  return newUid.replace(/\$/g, '');
};

export const isUrlPath = (str: string) => /^\/[a-zA-Z0-9\-/.]+$/.test(str);

export const isHtmlString = (str: string): boolean => /<[a-z][\s\S]*>/i.test(str);