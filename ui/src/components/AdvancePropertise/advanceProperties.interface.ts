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

/**
 * Represents the state type for advanced properties.
 */
export interface StateType {
  /**
   * The minimum number of characters allowed.
   */
  minChars?: string;

  /**
   * The maximum number of characters allowed.
   */
  maxChars?: number;

  /**
   * The minimum range allowed.
   */
  minRange?: number;

  /**
   * The maximum range allowed.
   */
  maxRange?: number;

  /**
   * The minimum size allowed.
   */
  minSize?: string;

  /**
   * The maximum size allowed.
   */
  maxSize?: number;

  /**
   * The default value.
   */
  defaultValue?: string;

  /**
   * The validation regular expression.
   */
  validationRegex?: string;

  /**
   * The title.
   */
  title?: string;

  /**
   * The URL.
   */
  url?: string;

  /**
   * Indicates if the field is mandatory.
   */
  mandatory?: boolean;

  /**
   * Indicates if only images are allowed.
   */
  allowImagesOnly?: boolean;

  /**
   * Indicates if the field is non-localizable.
   */
  nonLocalizable?: boolean;

  /**
   * Indicates if the object should be embedded.
   */
  embedObject?: boolean;

  /**
   * Indicates if the assets should be embedded.
   */
  embedAssests?: boolean;
}