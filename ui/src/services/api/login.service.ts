import { AUTH_ROUTES } from '../../utilities/constants';
import { User, SmsToken } from '../../pages/Login/login.interface';

import { postCall, getCall } from './service';

export const userSession = (data: User) => {
  try {
    return postCall(`${AUTH_ROUTES}/user-session`, data);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Error in userSession: ${error.message}`);
    } else {
      throw new Error('Unknown error in userSession');
    }
  }
};

export const requestSMSToken = (data: SmsToken) => {
  try {
    return postCall(`${AUTH_ROUTES}/request-token-sms`, data);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Error in requestSMSToken: ${error.message}`);
    } else {
      throw new Error('Unknown error in requestSMSToken');
    }
  }
};

export const getAppConfig = () => {
  try {
    return getCall(`${AUTH_ROUTES}/app-config`);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Error in getAppConfig: ${error.message}`);
    } else {
      throw new Error('Unknown error in getAppConfig');
    }
  }
};

export const checkSSOAuthStatus = (userId: string) => {
  try {
    return getCall(`${AUTH_ROUTES}/sso-status/${userId}`);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Error in checkSSOAuthStatus: ${error.message}`);
    } else {
      throw new Error('Unknown error in checkSSOAuthStatus');
    }
  }
};

export const logout = (email: string) => {
  try {
    return postCall(`${AUTH_ROUTES}/logout`, { email });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Error in logout: ${error.message}`);
    } else {
      throw new Error('Unknown error in logout');
    }
  }
};