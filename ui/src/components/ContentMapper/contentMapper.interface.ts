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
  value: string;
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
  contnetStackUid: string;
  isUpdated: boolean;
  otherCmsTitle: string;
  otherCmsUid: string;
  updateAt: string;
  id: string;
}

export interface FieldMapType {
  ContentstackFieldType: string;
  backupFieldType: string;
  contentstackField: string;
  contentstackFieldUid: string;
  isDeleted: boolean;
  otherCmsField: string;
  otherCmsType: string;
  uid: string;
  id: string;
  _canFreezeCheckbox?: boolean;
  _canSelect?: boolean;
}

export interface ItemStatus {
  [key: number]: string;
}

export interface FieldMetadata {
  multiline?: boolean;
  allow_rich_text?: boolean;
  markdown?: boolean;
}
export interface ContentTypeField {
  uid?: string;
  display_name?: string;
  data_type?: 'text' | 'number' | 'isodate' | 'json' | 'file';
  field_metadata?: FieldMetadata;
  enum?: any;
}
export interface ContentTypesSchema {
  [key: string]: ContentTypeField;
}

export type ExistingFieldType = {
  [key: string]: FieldTypes | undefined;
};

export interface Mapping {
  [key: string]: string | string[];
}
export interface ContentTypeList {
  title: string;
  schema: [];
}

export interface optionsType {
  label?: string;
  value?: object;
  isDisabled?: boolean;
}

export interface ExstingContentTypeMatch {
  [key: string]: string;
}