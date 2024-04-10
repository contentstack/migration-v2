import { NotificationItemProps } from '@contentstack/venus-components/build/components/Notification/Notification';
import { ReactNode } from 'react';
import { CTA } from '../../types/common.interface';

export interface LoginType {
  heading?: string;
  login?: Login;
  subtitle?: string;
  two_factor_authentication?: TFA;
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

export type IStates = {
  sso_loading: boolean;
  error: any;
  activeTab: any;
  redirect?: 'none' | 'forgot' | any;
  user: any;
  sso_id: any;
  sso_err: any;
  tfa: boolean;
  isLoginViaSSO: boolean;
  submitted: boolean;
};

export interface IProps {
  children?: ReactNode;
}

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

export interface User {
  email: string;
  password: string;
  region?: string | null;
  tfa_token?: string | null;
}

export interface UserRes {
  message?: string;
}

export interface SmsToken {
  email: string;
  password: any;
  region: string | null;
}
