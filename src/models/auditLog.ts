import { constants } from "../constants";
import { Schema, model, Document } from "mongoose";

interface Action {
  date: Date;
  user_id: string;
  user_first_name: string;
  user_last_name: string;
  module: string;
  action: string;
}

interface AuditLogDocument extends Document {
  project_id: Schema.Types.ObjectId;
  actions: Action[];
}

const auditLogSchema = new Schema<AuditLogDocument>({
  project_id: {
    type: Schema.Types.ObjectId,
    ref: "Project",
  },
  actions: {
    type: [
      {
        date: { type: Date, required: true },
        user_id: { type: String, required: true },
        user_first_name: { type: String, required: true },
        user_last_name: { type: String, required: true },
        module: { type: String, required: true, enum: constants.MODULES },
        action: {
          type: String,
          required: true,
          enum: constants.MODULES_ACTIONS,
        },
      },
    ],
    required: true,
  },
});

const AuditLogModel = model<AuditLogDocument>("AuditLog", auditLogSchema);

export default AuditLogModel;
