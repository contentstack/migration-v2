declare module 'migration-coremedia' {
  export class contentTypes {
    constructor();
    start(): Promise<void>;
  }
  
  export function extractLocales(dir: string): Set<string>;
}
