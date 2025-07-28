export interface IReadFiles {
  (path: string): Promise<JSON[]>;
}

export interface MergeStrategy {
  canMerge(key: string, sourceValue: any, targetValue: any): boolean;
  merge(key: string, sourceValue: any, targetValue: any): any;
}