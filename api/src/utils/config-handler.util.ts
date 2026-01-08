import { configHandler } from '@contentstack/cli-utilities';


/**
 * Sets the OAuth configuration for the CLI
 * @param userData - The user data
 */
export const setOAuthConfig = (userData: any) => {
  configHandler.set('oauthAccessToken', userData?.access_token);
  configHandler.set('oauthRefreshToken', userData?.refresh_token);
  configHandler.set('oauthDateTime', userData?.created_at);
  configHandler.set('email', userData?.email);
  configHandler.set('userUid', userData?.user_id);
  configHandler.set('oauthOrgUid', userData?.organization_uid);
  configHandler.set('authorisationType', 'OAUTH');
}

/**
 * Sets the Basic Auth configuration for the CLI
 * @param userData - The user data
 */
export const setBasicAuthConfig = (userData: any) => {
  configHandler.set('authtoken', userData?.authtoken);
  configHandler.set('email', userData?.email);
  configHandler.set('authorisationType', 'BASIC');
}