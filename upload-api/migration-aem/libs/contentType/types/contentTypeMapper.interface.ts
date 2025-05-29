interface IContentTypeMappersParams {
  templateData: any;
  affix: string;
}

interface ICreateMapperSchemaParams {
  itemSchema: object;
  affix: string;
}

export interface IContentTypeMappers {
  (params: IContentTypeMappersParams): any;
}

export interface ICreateMapperSchema {
  (params: ICreateMapperSchemaParams): any;
}