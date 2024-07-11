import { IDropDown } from '../../../context/app/app.interface';
export interface AddStackCMSData {
  primary_cta: PrimaryCta;
  secondary_cta: SecondaryCta;
  stack_description: string;
  stack_description_placeholder: string;
  stack_locale_description: string;
  stack_locales: string;
  stack_name: string;
  stack_name_placeholder: string;
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