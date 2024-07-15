import { AUTH_ROUTES } from '../../utilities/constants';
import { User, SmsToken } from '../../pages/Login/login.interface';

import { postCall } from './service';

export const userSession = (data: User) => {
  try {
    return postCall(`${AUTH_ROUTES}/user-session`, data);
  } catch (error: any) {
    return error;
  }
};

export const requestSMSToken = (data: SmsToken) => {
  try {
    return postCall(`${AUTH_ROUTES}/request-token-sms`, data);
  } catch (error: any) {
    return error;
  }
};
