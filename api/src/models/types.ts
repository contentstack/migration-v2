/**
 * Represents a user.
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
}

/**
 * Represents the payload of an application token.
 */
export interface AppTokenPayload {
  region: string;
  user_id: string;
  is_sso: boolean;
}

/**
 * Represents the LoginServiceType interface.
 * @interface
 */
export interface LoginServiceType {
  data: any;
  status: number;
}

/**
 * Represents the migration query type.
 */
export interface MigrationQueryType {
  id: string;
  org_id: string;
  region: string;
  owner: string;
}

export interface Locale {
  code: string;
  name: string;
  fallback_locale: string;
  uid: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}