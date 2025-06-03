interface IContentTypeMappersParams {
  templateData: any;
  affix: string;
}


interface IItemSchema {
  ":items"?: {
    [key: string]: any; // Replace 'any' with a more specific type if known
  };
  ":itemsOrder"?: string[];
  // Add other properties if needed
}

interface IContentTypeProcessorParams {
  itemSchema: IItemSchema;
  affix: string;
}

export interface IContentTypeMappers {
  (params: IContentTypeMappersParams): any;
}

export interface IcontentTypeProcessor {
  (params: IContentTypeProcessorParams): any;
}


export interface IContentTypeSchemaBuilder {
  (params: IContentTypeProcessorParams): any;
}