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
  "migration._id"?: string;
  org_id: string;
  region: string;
  owner: string;
}
