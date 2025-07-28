import ComponentTracker from "../../../componentMaker/componentTracker";

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

interface IContentTypeSchemaParams {
  type: string;
}


interface IContentTypeProcessorParams {
  itemSchema: IItemSchema;
  affix: string;
  tracker: ComponentTracker;
}

export interface IContentTypeMappers {
  (params: IContentTypeMappersParams): any;
}

export interface IcontentTypeProcessor {
  (params: IContentTypeProcessorParams): any;
}


export interface IContentTypeSchemaBuilder {
  (params: IContentTypeSchemaParams): any;
}