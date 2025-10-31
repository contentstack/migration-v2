interface IContentTypeMakerParams {
  templateData: any;
  affix: string;
  contentstackComponents: any;
}

export interface IContentTypeMaker {
  (params: IContentTypeMakerParams): any
}