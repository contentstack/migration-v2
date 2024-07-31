import { AUTH_ROUTES } from '../../utilities/constants';
import { User, SmsToken } from '../../pages/Login/login.interface';

import { postCall } from './service';

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
