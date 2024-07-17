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
   * The placeholder text for the stack description.
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
   * The placeholder text for the stack name.
   */
  stack_name_placeholder: string;

  /**
   * The title of the stack.
   */
  title: string;
}

/**
 * Represents the primary call-to-action button for adding a stack.
 */
export interface PrimaryCta {
  title: string;
}

/**
 * Represents the Secondary CTA interface.
 */
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
   * The placeholder for the stack description input field.
   */
  stack_description_placeholder: '',
  /**
   * The localized description of the stack.
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
   * The placeholder for the stack name input field.
   */
  stack_name_placeholder: '',
  /**
   * The title of the stack.
   */
  title: ''
};

/**
 * Represents the props for the AddStack component.
 */
export interface AddStackProps {
  /**
   * The default values for the stack.
   */
  defaultValues: Stack;

  /**
   * The locales for the dropdown.
   */
  locales: IDropDown[];

  /**
   * The function to be called when the form is submitted.
   * @param value - The submitted stack value.
   */
  onSubmit: (value: Stack) => void;

  /**
   * The selected organisation.
   */
  selectedOrganisation: string;

  /**
   * The function to close the modal.
   */
  closeModal: () => void;
}
/**
 * Represents a stack.
 */
export interface Stack {
  /**
   * The name of the stack.
   */
  name: string;

  /**
   * The description of the stack.
   */
  description: string;

  /**
   * The locale of the stack.
   */
  locale: string;
}
/**
 * Represents the data structure for a stack.
 */
export interface StackData {
  name: string;
  description: string;
  locale: Locale;
}
/**
 * Represents a locale.
 */
interface Locale {
  value: string;
}

/**
 * Represents the response object returned by the server.
 */
export interface Response {
  data: Data;
}
/**
 * Represents the data structure for the 'Data' interface.
 */
interface Data {
  locales: LocaleType;
}
/**
 * Represents a type that defines a mapping of string keys to string values.
 */
interface LocaleType {
  [key: string]: string;
}
/**
 * Represents the errors that can occur when adding a stack.
 */
export interface Errors {
  name: string;
  locale: string;
  description: string;
}