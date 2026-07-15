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
    | 'global_field'
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

/** Raw shapes read directly off the DatoCMS export — kept close to the CMA's own resource shapes. */
export interface DatoContentType {
  id: string;
  api_key: string;
  name: string;
  modular_block: boolean;
  all_locales_required?: boolean;
}

export interface DatoFieldValidators {
  item_item_type?: { item_types: string[] };
  items_item_type?: { item_types: string[] };
  single_block_blocks?: { item_types: string[] };
  rich_text_blocks?: { item_types: string[] };
  structured_text_blocks?: { item_types: string[] };
  structured_text_inline_blocks?: { item_types: string[] };
  structured_text_links?: { item_types: string[] };
  [key: string]: any;
}

export interface DatoField {
  id: string;
  label: string;
  field_type: string;
  api_key: string;
  localized: boolean;
  validators: DatoFieldValidators;
  appearance?: { editor?: string; parameters?: Record<string, any>; field_extension?: string };
  item_type: { id: string; type: 'item_type' };
}

export interface DatoFieldsEntry {
  model_name: string;
  model_api_key: string;
  is_block: boolean;
  fields: DatoField[];
}
