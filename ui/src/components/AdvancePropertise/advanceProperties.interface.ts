import { FieldMapType } from '../ContentMapper/contentMapper.interface';

export interface SchemaProps {
  fieldtype: string;
  value: any;
  rowId: string;
  updateFieldSettings: (rowId: string, value: any, checkBoxChanged: boolean) => void;
  isLocalised: boolean;
  closeModal: () => void;
  data: FieldMapType;
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
}