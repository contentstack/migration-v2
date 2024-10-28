import { Advanced, FieldMapType } from '../ContentMapper/contentMapper.interface';

/**
 * Represents the properties of a schema.
 */
export interface SchemaProps {
  /**
   * The type of the field.
   */
  fieldtype: string;
  
  /**
   * The updated settings for the field.
   */
  value: UpdatedSettings;
  
  /**
   * The ID of the row.
   */
  rowId: string;
  
  /**
   * A function to update the field settings.
   * @param rowId - The ID of the row.
   * @param value - The advanced settings.
   * @param checkBoxChanged - Indicates whether the checkbox has changed.
   */
  updateFieldSettings: (rowId: string, value: Advanced, checkBoxChanged: boolean) => void;
  
  /**
   * Indicates whether the field is localized.
   */
  isLocalised: boolean;
  
  /**
   * A function to close the modal.
   */
  closeModal: () => void;
  
  /**
   * The data for the field map.
   */
  data: FieldMapType;
  
  /**
   * The ID of the project.
   */
  projectId?: string;
}

/**
 * Represents the updated settings for a component.
 */
export interface UpdatedSettings {
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
   * The default value for the component.
   */
  defaultValue?: string;

  /**
   * The regular expression used for validation.
   */
  validationRegex?: string;

  /**
   * The title of the component.
   */
  title?: string;

  /**
   * The URL associated with the component.
   */
  url?: string;

  /**
   * Indicates whether the component is mandatory.
   */
  mandatory?: boolean;

  /**
   * Indicates whether only images are allowed.
   */
  allowImagesOnly?: boolean;

  /**
   * Indicates whether the component is non-localizable.
   */
  nonLocalizable?: boolean;

  multiple?: boolean;

  embedObjects?: any;

  default_value?: string;
  options?: any[]
}

/**
 * Represents the props for the AdvanceProperties component.
 */
export interface Props {
  /**
   * The data for the component.
   */
  data: SchemaProps;

  /**
   * The optional states for the component.
   */
  states?: StateType;

  /**
   * The callback function for handling changes in the component.
   * @param field - The field that was changed.
   * @param event - The event object associated with the change.
   * @param checkBoxChanged - Indicates whether the change was triggered by a checkbox.
   */
  handleChange?: (field: string, event: any, checkBoxChanged: boolean) => void;

  /**
   * The callback function for handling toggles in the component.
   * @param field - The field that was toggled.
   * @param value - The new value of the toggle.
   * @param checkBoxChanged - Indicates whether the toggle was triggered by a checkbox.
   */
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

export interface optionsType{
  label?:string;
  key?:string;
  value:string
}