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

/**
 * Represents the field mapping type for ContentMapper.
 */
export interface FieldMapType {
  /** The Contentstack field type. */
  ContentstackFieldType: string;
  /** The child field mappings. */
  child?: FieldMapType[] | undefined;
  /** The backup field type. */
  backupFieldType: string;
  /** The Contentstack field name. */
  contentstackField: string;
  /** The Contentstack field UID. */
  contentstackFieldUid: string;
  /** Indicates if the field is deleted. */
  isDeleted: boolean;
  /** The field name in another CMS. */
  otherCmsField: string;
  /** The field type in another CMS. */
  otherCmsType: string;
  /** The UID of the field mapping. */
  uid: string;
  /** The ID of the field mapping. */
  id: string;
  /** Indicates if the field can be selected. */
  _canSelect?: boolean;
  /** Advanced field options. */
  advanced?: Advanced;
  /** The Contentstack UID. */
  contentstackUid: string;
}

export interface Advanced {
  validationRegex: string;
  Mandatory: boolean;
  Multiple: boolean;
  Unique: boolean;
  NonLocalizable: boolean;
  EmbedObject?: boolean;
}

export interface ItemStatus {
  [key: number]: string;
}

export interface FieldMetadata {
  multiline?: boolean;
  allow_rich_text?: boolean;
  markdown?: boolean;
}
export interface ContentTypesSchema {
  uid?: string;
  display_name?: string;
  data_type?: 'text' | 'number' | 'isodate' | 'json' | 'file' | 'reference' | 'group';
  field_metadata?: FieldMetadata;
  enum?: any;
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

export interface optionsType {
  label?: string;
  value?: object;
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


