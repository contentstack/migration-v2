import { SelectProps } from '@contentstack/venus-components/build/components/Select/AsyncSelect';
import { CTA } from '../../types/common.interface';

export interface ContentMapperObj {
  mapData: mapDataType;
}

interface mapDataType {
  contentTypes: ContentType[];
  projectId: string;
}
export interface ContentMapperType {
  content_types_heading?: string;
  cta: CTA;
  description: string;
  step_title: string;
  contentstack_fields: ContentstackFields;
}

export interface ContentstackFields {
  title: string;
  field_types?: FieldTypes[];
}

export interface FieldTypes {
  uid?: any | string;
  label: string;
  value: any;
  id?: string;
  isDisabled?: boolean;
}
export interface TableTypes {
  sortBy: any;
  searchText: string;
  skip: number;
  limit: number;
  startIndex: number;
  stopIndex: number;
}

export interface ContentType {
  contentstackTitle: string;
  contentstackUid: string;
  isUpdated: boolean;
  otherCmsTitle: string;
  otherCmsUid: string;
  updateAt: string;
  id?: string;
  status: string;
  type: string;
  fieldMapping?: FieldMapType[] | [];
}

export interface FieldMapType {
  contentstackFieldType: string;
  child?: FieldMapType[] | undefined;
  backupFieldType: string;
  contentstackField: string;
  contentstackFieldUid: string;
  isDeleted: boolean;
  otherCmsField: string;
  otherCmsType: string;
  uid: string;
  id: string;
  _canSelect?: boolean;
  advanced?: Advanced;
  contentstackUid: string;
  _invalid?: boolean;
  backupFieldUid: string;
  /**
   * NOTE: The codebase historically used the misspelling `refrenceTo`.
   * Some older payloads / UI code (source repo) use the correct `referenceTo`.
   * Keep both for backward compatibility.
   */
  refrenceTo: string[];
  initialRefrenceTo: string[];
  referenceTo?: string[];
}

export interface Advanced {
  validationRegex?: string;
  mandatory?: boolean;
  multiple?: boolean;
  unique?: boolean;
  nonLocalizable?: boolean;
  embedObject?: boolean;
  embedObjects?: any;
  reference_to?: string[];
  taxonomies?: Array<{ taxonomy_uid?: string } | string>;
  minChars?: string;
  maxChars?: number;
  minRange?: number;
  maxRange?: number;
  default_value?: string | boolean;
  options?: any[];
  minSize?: number;
  maxSize?: number;
  referenedItems?: string[];
  title?: string;
  url?: string;
  initial?: Omit<Advanced, 'initial'>;
}

export interface ItemStatus {
  [key: number]: string;
}

export interface FieldMetadata {
  multiline?: boolean;
  allow_rich_text?: boolean;
  markdown?: boolean;
  allow_json_rte?: boolean;
}
export interface ContentTypesSchema {
  blocks?: ContentTypesSchema[];
  display_type: string;
  data_type?:
    | 'text'
    | 'number'
    | 'isodate'
    | 'json'
    | 'file'
    | 'reference'
    | 'group'
    | 'boolean'
    | 'link'
    | 'Marketplace app'
    | 'Extension'
    | 'blocks'   
    | 'modular_blocks_child';  
  display_name: string;
  enum?: any;
  error_messages?: ErrorMessages;
  field_metadata?: FieldMetadata;
  mandatory?: boolean;
  multiple?: boolean;
  non_localizable?: boolean;
  schema?: ContentTypesSchema[];
  uid?: string;
  unique?: boolean;
  validationRegex?: string;
  format?: string;
  'No matches found'?: string;
}

interface ErrorMessages {
  format: string;
}
// export interface ContentTypesSchema {
//   [key: string]: ContentTypeField;
// }

export type ExistingFieldType = {
  [key: string]: FieldTypes | undefined | { label: string | undefined; value: ContentTypesSchema };
};

export interface Mapping {
  [key: string]: string | string[];
}
export interface ContentTypeList {
  title: string;
  schema: ContentTypesSchema[];
  uid: string;
}

export interface Value {
  uid?: string;
  data_type?: string;
  display_name?: string;
  options?: object;
  'No matches found'?: string;
}
export interface OptionsType {
  label?: string;
  value?: ContentTypesSchema;
  isDisabled?: boolean;
  uid?: string;
}

export interface ExstingContentTypeMatch {
  [key: string]: string;
}

export interface UidMap {
  [key: string]: boolean;
}

export interface ContentTypeMap {
  [key: string]: string;
}

export interface ContentTypeSaveHandles {
  handleSaveContentType: () => void;
}
export type MouseOrKeyboardEvent =
  | React.MouseEvent<HTMLElement, MouseEvent>
  | React.KeyboardEvent<HTMLButtonElement>;

export interface MappingFields {
  [key: string]: MappingObj;
}

export interface MappingObj {
  label: string;
  options: Mapping;
  type: string;
}

export interface FieldHistoryObj {
  [key: string]: ModifiedField[];
}

export interface FieldObj {
  [key: string]: ModifiedField;
}

export interface ModifiedField {
  at: number;
  checked: boolean;
  id: string;
  backupFieldType: string;
  parentId: string;
  uid: string;
  _canSelect?: boolean;
  contentstackFieldType?: string;
}

export interface EntryMapperType {
  id: string;
  projectId: string;
  contentTypeId: string;
  contentTypeUid: string;
  entryName: string;
  otherCmsEntryUid: string;
  isUpdate: boolean;
  contentstackEntryUid?: string;
  _canSelect?: boolean;
  isDuplicateEntry?: boolean;
}

export interface AssetMapperType {
  id: string;
  projectId: string;
  otherCmsAssetUid: string;
  filename: string;
  title: string;
  file_size: number | string;
  assetPath: string;
  isUpdate: boolean;
  isChanged?: boolean;
  contentstackAssetUid?: string;
  _canSelect?: boolean;
}