/**
 * Represents a user.
 */
export interface User {
  email: string; // The email of the user.
  password: string; // The password of the user.
}

/**
 * Represents the payload of an app token.
 */
export interface AppTokenPayload {
  region: string; // The region of the app token.
  user_id: string; // The user ID associated with the app token.
}

/**
 * Represents the response from a login service.
 */
export interface LoginServiceType {
  data: any; // The data returned by the login service.
  status: number; // The status code of the response.
}

/**
 * Represents a migration query.
 */
export interface MigrationQueryType {
  id: string; // The ID of the migration query.
  org_id: string; // The organization ID associated with the migration query.
  region: string; // The region of the migration query.
  owner: string; // The owner of the migration query.
}
