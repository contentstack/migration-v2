export interface User {
  email: string;
  password: string;
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
