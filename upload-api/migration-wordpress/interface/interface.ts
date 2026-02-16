export interface FieldAdvanced {
  mandatory?: boolean;
  terms?: string[];
  [key: string]: any; // Allow for other advanced properties
}

export interface Field {
  uid: string;
  otherCmsField: string;
  otherCmsType: string;
  contentstackField: string;
  contentstackFieldUid: string;
  contentstackFieldType: 'rte' | 'file' | 'text' | 'url' | 'modular_blocks' | 'taxonomy' | 'json' | 'single_line_text' | 'group' | string;
  backupFieldType: string;
  backupFieldUid: string;
  advanced?: FieldAdvanced;
  isDeleted?: boolean;
  refrenceTo?: string[];
}

export interface DataConfig {
    plan: {
        dropdown: { optionLimit: number }
    },
    cmsType: string,
    isLocalPath: boolean,
    awsData: {
        awsRegion: string,
        awsAccessKeyId: string,
        awsSecretAccessKey: string,
        awsSessionToken: string,
        bucketName: string,
        bucketKey: string
    },
    localPath: string
      
}

export type CT = Field[];

export interface WordPressBlockAttributes {
    metadata?: {
        name?: string;
    };
    [key: string]: any;
}

export interface WordPressBlock {
    name: string;
    clientId: string;
    attributes?: WordPressBlockAttributes;
    innerBlocks?: WordPressBlock[];
    [key: string]: any;
}

export interface Categories {
    "wp:term_id" : string,
    "wp:category_nicename": string,
    "wp:category_parent": string,
    "wp:cat_name": string,
    "wp:category_description": string
}