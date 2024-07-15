import { NotificationItemProps } from '@contentstack/venus-components/build/components/Notification/Notification';
import { ReactNode } from 'react';
import { CTA } from '../../types/common.interface';

/**
 * Represents the login type.
 */
export interface LoginType {
  /**
   * The heading of the login page.
   */
  heading?: string;

  /**
   * The login details.
   */
  login?: Login;

  /**
   * The subtitle of the login page.
   */
  subtitle?: string;

  /**
   * The two-factor authentication details.
   */
  two_factor_authentication?: TFA;

  /**
   * The copyright text.
   */
  copyrightText?: string;
}
interface Login {
  cta: CTA;
  email: string;
  notification?: NotificationItemProps;
  password: string;
  placeholder: Placeholder;
  title: string;
  validation_messages: Placeholder;
}
interface Placeholder {
  email?: string;
  password?: string;
}
interface TFA {
  cta?: CTA;
  security_code?: Security;
  send_sms?: SMS;
  title?: string;
}
interface Security {
  placeholder?: string;
  title?: string;
}
interface SMS {
  link_text?: string;
  pre_link_text?: string;
}

/**
 * Represents the interface for the login states.
 */
export type IStates = {
  sso_loading: boolean;
  error: any;
  activeTab: any;
  redirect?: 'none' | 'forgot' | any;
  user: User;
  sso_id: string;
  sso_err: string;
  tfa: boolean;
  isLoginViaSSO: boolean;
  submitted: boolean;
};

/**
 * Represents the props for the Login component.
 */
export interface IProps {
  children?: ReactNode;
}

/**
 * Represents the default states for the login interface.
 */
export const defaultStates: IStates = {
  sso_loading: false,
  activeTab: 0,
  error: {},
  redirect: 'none',
  user: {
    email: '',
    password: ''
  },
  sso_id: '',
  sso_err: '',
  tfa: false,
  isLoginViaSSO: false,
  submitted: false
};

/**
 * Represents a user object.
 */
export interface User {
  /**
   * The email address of the user.
   */
  email: string;

  /**
   * The password of the user.
   */
  password: string;

  /**
   * The region of the user. (Optional)
   */
  region?: string | null;

  /**
   * The two-factor authentication token of the user. (Optional)
   */
  tfa_token?: string | null;
}

/**
 * Represents the response object returned by the server when a user logs in.
 */
export interface UserRes {
  /**
   * The message associated with the response.
   */
  message?: string;

  /**
   * The status code of the response.
   */
  status?: number;

  /**
   * The data payload of the response.
   */
  data?: Response;
}

/**
 * Represents the response object returned from the login API.
 */
interface Response {
  notice?: string;
  error_message?: string;
}

/**
 * Represents the SMS token used for login.
 */
export interface SmsToken {
  email: string;
  password: string;
  region: string | null;
}
