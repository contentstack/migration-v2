// src/models/Authentication.ts

import { Schema, model, Document } from "mongoose";
import { CS_REGIONS } from "../constants";

interface AuthenticationDocument extends Document {
  user_id: string;
  region: string;
  authtoken: string;
}

const authenticationSchema = new Schema<AuthenticationDocument>(
  {
    user_id: { type: String, required: true },
    region: { type: String, required: true, enum: CS_REGIONS },
    authtoken: { type: String, required: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

const AuthenticationModel = model<AuthenticationDocument>(
  "Authentication",
  authenticationSchema
);

export default AuthenticationModel;
