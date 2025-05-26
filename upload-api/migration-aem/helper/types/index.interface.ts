export interface IReadFiles {
  (path: string): Promise<JSON[]>;
}