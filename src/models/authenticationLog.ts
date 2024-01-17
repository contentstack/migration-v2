// src/models/Authentication.ts

import { Schema, model, Document } from "mongoose";

// Disabling this error until API's being implemented
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Authentication {
  user_id: string;
  region: string;
  authtoken: string;
  created_at: string;
  modified_at: string;
}

interface AuthenticationDocument extends Document {
  user_id: string;
  region: string;
  authtoken: string;
  created_at: string;
  modified_at: string;
}

const authenticationSchema = new Schema<AuthenticationDocument>({
  user_id: { type: String, required: true },
  region: { type: String, required: true },
  authtoken: { type: String, required: true },
  created_at: { type: String, required: true },
  modified_at: { type: String, required: true },
});

const AuthenticationModel = model<AuthenticationDocument>(
  "Authentication",
  authenticationSchema
);

export default AuthenticationModel;
