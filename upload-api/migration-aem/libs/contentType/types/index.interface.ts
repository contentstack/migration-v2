
export interface IConvertContentType {
  (path: string): unknown;
}

export type GroupKey = 'templateName' | 'templateType' | 'title';