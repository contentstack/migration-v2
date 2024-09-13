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
  ContentstackFieldType: string;
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
}

export interface Advanced {
  validationRegex: string;
  Mandatory?: boolean;
  Multiple?: boolean;
  Unique?: boolean;
  NonLocalizable?: boolean;
  EmbedObject?: boolean;
  EmbedObjects?:any;
  MinChars?: string;
  MaxChars?: number;
  MinRange?: number,
  MaxRange?: number,
  Default_value?:string,
  options?:[]
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
  data_type?: 'text' | 'number' | 'isodate' | 'json' | 'file' | 'reference' | 'group' | 'boolean' | 'link';
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
  [key: string]: FieldTypes | undefined;
};

export interface Mapping {
  [key: string]: string | string[];
}
export interface ContentTypeList {
  title: string;
  schema: ContentTypesSchema[];
  uid:  string;
}

export interface Value {
  uid?:string;
  data_type?: string;
  display_name?: string;
  options?: object;
  'No matches found'?:string;
}
export interface OptionsType {
  label?: string;
  value?: ContentTypesSchema;
  isDisabled?: boolean;
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
export type MouseOrKeyboardEvent = React.MouseEvent<HTMLElement, MouseEvent> | React.KeyboardEvent<HTMLButtonElement>;

export interface MappingFields {
  [key: string]: MappingObj;
}

export interface MappingObj {
  label: string;
  options: Mapping;
}


