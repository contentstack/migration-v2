import { IDropDown } from '../../../context/app/app.interface';
/**
 * Represents the data structure for adding a stack in CMS.
 */
export interface AddStackCMSData {
  /**
   * The primary call-to-action for the stack.
   */
  primary_cta: PrimaryCta;
  
  /**
   * The secondary call-to-action for the stack.
   */
  secondary_cta: SecondaryCta;
  
  /**
   * The description of the stack.
   */
  stack_description: string;
  
  /**
   * The placeholder text for the stack description input field.
   */
  stack_description_placeholder: string;
  
  /**
   * The localized description of the stack.
   */
  stack_locale_description: string;
  
  /**
   * The locales supported by the stack.
   */
  stack_locales: string;
  
  /**
   * The name of the stack.
   */
  stack_name: string;
  
  /**
   * The placeholder text for the stack name input field.
   */
  stack_name_placeholder: string;
  
  /**
   * The title of the stack.
   */
  title: string;
}

export interface PrimaryCta {
  title: string;
}

export interface SecondaryCta {
  title: string;
}

/**
 * Interface representing the default data for AddStackCMSData.
 */
export const defaultAddStackCMSData: AddStackCMSData = {
  /**
   * The title of the primary call-to-action button.
   */
  primary_cta: {
    title: ''
  },
  /**
   * The title of the secondary call-to-action button.
   */
  secondary_cta: {
    title: ''
  },
  /**
   * The description of the stack.
   */
  stack_description: '',
  /**
   * The placeholder for the stack description.
   */
  stack_description_placeholder: '',
  /**
   * The locale-specific description of the stack.
   */
  stack_locale_description: '',
  /**
   * The locales supported by the stack.
   */
  stack_locales: '',
  /**
   * The name of the stack.
   */
  stack_name: '',
  /**
   * The placeholder for the stack name.
   */
  stack_name_placeholder: '',
  /**
   * The title of the stack.
   */
  title: ''
};

export interface AddStackProps {
  defaultValues: Stack;
  locales: IDropDown[];
  onSubmit: (value: Stack) => {};
  selectedOrganisation: string;
  closeModal: () => void;
}
export interface Stack {
  name: string;
  description: string;
  locale: string;
}
export interface StackData {
  name: string;
  description: string;
  locale: Locale;
}
interface Locale {
  value: string;
}

export interface Response {
  data: Data;
}
interface Data {
  locales: LocaleType;
}
interface LocaleType {
  [key: string]: string;
}
export interface Errors {
  name: string;
  locale: string;
  description: string;
}