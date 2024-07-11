import { LoginType } from '../../pages/Login/login.interface';

/**
 * Represents an account object.
 */
export interface AccountObj {
  children: React.ReactNode;
  data: LoginType;
}
