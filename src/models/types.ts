export interface User {
  email: string;
  password: string;
}

export interface AppTokenPayload {
  region: string;
  user_id: string;
}

export interface LoginServiceType {
  data: any;
  status: number;
}

export interface MigrationQueryType {
  _id: string;
  org_id: string;
  region: string;
  owner: string;
}
