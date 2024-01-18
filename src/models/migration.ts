import { Schema, model, Document } from "mongoose";
import { constants } from "../constants";

interface LegacyCMS {
  cms: string;
  file_format: string;
  import_data: string;
}

interface DestinationCMS {
  stack_id: string;
  org_id: string;
}

interface Modules {
  legacy_cms: LegacyCMS;
  destination_cms: DestinationCMS;
}

interface Migration {
  name: string;
  description: string;
  modules: Modules;
}

interface ExecutionLog {
  log_url: string;
}

interface MigrationDocument extends Document {
  region: string;
  org_id: string;
  owner: string;
  created_by: string;
  name: string;
  description: string;
  status: boolean;
  migration: Migration;
  execution_log: ExecutionLog;
}

const migrationSchema = new Schema<MigrationDocument>(
  {
    region: { type: String, required: true, enum: constants.CS_REGIONS },
    org_id: { type: String, required: true },
    owner: { type: String, required: true },
    created_by: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: Boolean, required: true, default: true },
    migration: {
      name: { type: String, required: true },
      description: { type: String, required: true },
      modules: {
        legacy_cms: {
          cms: { type: String, required: true },
          file_format: { type: String, required: true },
          import_data: { type: String, required: true },
        },
        destination_cms: {
          stack_id: { type: String, required: true },
          org_id: { type: String, required: true },
        },
      },
    },
    execution_log: {
      log_url: { type: String, required: true },
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

const MigrationModel = model<MigrationDocument>("Migration", migrationSchema);

export default MigrationModel;
