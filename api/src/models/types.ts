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
