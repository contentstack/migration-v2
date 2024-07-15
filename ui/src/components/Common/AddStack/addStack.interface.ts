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

export const defaultAddStackCMSData: AddStackCMSData = {
  primary_cta: {
    title: ''
  },
  secondary_cta: {
    title: ''
  },
  stack_description: '',
  stack_description_placeholder: '',
  stack_locale_description: '',
  stack_locales: '',
  stack_name: '',
  stack_name_placeholder: '',
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