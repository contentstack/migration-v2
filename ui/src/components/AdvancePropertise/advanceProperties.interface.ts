import { Advanced, FieldMapType } from '../ContentMapper/contentMapper.interface';

export interface SchemaProps {
  fieldtype: string;
  value: UpdatedSettings;
  rowId: string;
  updateFieldSettings: (rowId: string, value: Advanced, checkBoxChanged: boolean) => void;
  isLocalised: boolean;
  closeModal: () => void;
  data: FieldMapType;
  projectId?: string;
}

export interface UpdatedSettings {
  MinChars?: string;
  MaxChars?: number;
  MinRange?: number;
  MaxRange?: number;
  minSize?: string;
  maxSize?: number;
  DefaultValue?: string;
  ValidationRegex?: string;
  title?: string;
  url?: string;
  Mandatory?: boolean;
  AllowImagesOnly?: boolean;
  NonLocalizable?: boolean;
}

export interface Props {
  data: SchemaProps;
  states?: StateType;
  handleChange?: (field: string, event: any, checkBoxChanged: boolean) => void;
  handleToggle?: (field: string, value: boolean, checkBoxChanged: boolean) => void;
}

export interface StateType {
  minChars?: string;
  maxChars?: number;
  minRange?: number;
  maxRange?: number;
  minSize?: string;
  maxSize?: number;
  defaultValue?: string;
  validationRegex?: string;
  title?: string;
  url?: string;
  mandatory?: boolean;
  allowImagesOnly?: boolean;
  nonLocalizable?: boolean;
  embedObject?: boolean;
  embedAssests?: boolean;
}