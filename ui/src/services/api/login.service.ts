import { AUTH_ROUTES } from '../../utilities/constants';
import { User, SmsToken } from '../../pages/Login/login.interface';

import { postCall } from './service';

/**
 * Creates a user session by making a POST request to the '/user-session' endpoint.
 * @param data - The user data to be sent in the request body.
 * @returns A Promise that resolves to the response from the server, or an error object if the request fails.
 */
export const userSession = (data: User) => {
  try {
    return postCall(`${AUTH_ROUTES}/user-session`, data);
  } catch (error: any) {
    return error;
  }
};

/**
 * Requests an SMS token.
 * @param data - The data for the SMS token request.
 * @returns A Promise that resolves to the response of the API call.
 */
export const requestSMSToken = (data: SmsToken) => {
  try {
    return postCall(`${AUTH_ROUTES}/request-token-sms`, data);
  } catch (error: any) {
    return error;
  }
};
