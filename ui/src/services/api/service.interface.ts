/**
 * Represents an error object.
 */
export interface Error {
  code: number;
  message: string;
}

/**
 * Represents the response object for an organisation.
 */
export interface OrganisationResponse {
  org_id: string;
  org_name: string;
}

/**
 * Represents the response object returned by the stack API.
 */
export interface StackResponse {
  name: string;
  api_key: string;
  master_locale: string;
  locales: [];
  created_at: string;
}

/**
 * Represents the response object for a migration.
 */
export interface MigrationResponse {
  legacy_cms: LegacyCms;
  _id: string;
  region: string;
  org_id: string;
  owner: string;
  created_by: string;
  former_owner_ids: any[];
  prefix: string;
  name: string;
  description: string;
  status: number;
  created_at: string;
  updated_at: string;
  destination_stack_id: string;
  current_step: number;
}

/**
 * Represents the Legacy CMS interface.
 */
export interface LegacyCms {
  cms: string;
  file_format: string;
}

/**
 * Represents the default migration response object.
 */
export const defaultMigrationResponse: MigrationResponse = {
  legacy_cms: {
    cms: '',
    file_format: ''
  },
  _id: '',
  region: '',
  org_id: '',
  owner: '',
  created_by: '',
  former_owner_ids: [],
  name: '',
  description: '',
  status: 0,
  created_at: '',
  updated_at: '',
  destination_stack_id: '',
  prefix: '',
  current_step: 1
};
