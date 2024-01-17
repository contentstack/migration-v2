import { Schema, model, Document } from "mongoose";

interface Action {
  date: string;
  user_id: string;
  user_name: string;
  module: string;
  action: string;
}
// Disabling this error until API's being implemented
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface AuditLog {
  project_id: string;
  actions: Action[];
}

interface AuditLogDocument extends Document {
  project_id: string;
  actions: Action[];
}

const actionSchema = new Schema<Action>({
  date: { type: String, required: true },
  user_id: { type: String, required: true },
  user_name: { type: String, required: true },
  module: { type: String, required: true },
  action: { type: String, required: true },
});

const auditLogSchema = new Schema<AuditLogDocument>({
  project_id: { type: String, required: true },
  actions: { type: [actionSchema], required: true },
});

const AuditLogModel = model<AuditLogDocument>("AuditLog", auditLogSchema);

export default AuditLogModel;
