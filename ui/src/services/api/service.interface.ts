import { FileDetails } from '../../context/app/app.interface';

export interface Error {
  code: number;
  message: string;
}

export interface OrganisationResponse {
  org_id: string;
  org_name: string;
}

export interface StackResponse {
  name: string;
  api_key: string;
  master_locale: string;
  locales: [];
  created_at: string;
}

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
  isMigrationStarted: boolean;
  isMigrationCompleted: boolean;
  migration_execution: boolean;
}

export interface LegacyCms {
  cms: string;
  file_format: string;
}

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
  current_step: 1,
  isMigrationStarted: false,
  isMigrationCompleted: false,
  migration_execution: false
};
interface data {
  file_details: FileDetails;
  message: string;
  status: number;
}
export interface axiosResponse {
  config?: {};
  data?: data;
  status: number;
  statusText: string;
}
