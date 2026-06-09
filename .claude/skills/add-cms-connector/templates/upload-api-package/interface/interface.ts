export interface FieldAdvanced {
  mandatory?: boolean;
  multiple?: boolean;
  terms?: string[];
  [key: string]: any; // Allow for other advanced properties
}

export interface Field {
  uid: string;
  otherCmsField: string;
  otherCmsType: string;
  contentstackField: string;
  contentstackFieldUid: string;
  contentstackFieldType:
    | 'rte'
    | 'file'
    | 'text'
    | 'url'
    | 'modular_blocks'
    | 'taxonomy'
    | 'json'
    | 'single_line_text'
    | 'group'
    | string;
  backupFieldType: string;
  backupFieldUid: string;
  advanced?: FieldAdvanced;
  isDeleted?: boolean;
  refrenceTo?: string[];
}

export interface DataConfig {
  plan: {
    dropdown: { optionLimit: number };
  };
  cmsType: string;
  isLocalPath: boolean;
  awsData: {
    awsRegion: string;
    awsAccessKeyId: string;
    awsSecretAccessKey: string;
    awsSessionToken: string;
    bucketName: string;
    bucketKey: string;
  };
  localPath: string;
}

export type CT = Field[];
