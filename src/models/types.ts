export interface User {
  email: string;
  password: string;
}

export interface UserProfile {
  user: {
    email: string;
    first_name: string;
    last_name: string;
    orgs: [{ org_id: string; org_name: string }];
  };
}

export interface ResponseType {
  message: string;
  status: number;
  migration_token: string | null;
}

export interface MigrationPayload {
  region: string;
  user_id: string;
}
