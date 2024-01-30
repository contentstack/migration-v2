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
  created_at: Date;
  updated_at: Date;
  modules: Modules;
}

interface ExecutionLog {
  log_url: string;
}

interface ProjectDocument extends Document {
  region: string;
  org_id: string;
  owner: string;
  created_by: string;
  name: string;
  description: string;
  status: boolean;
  migration: Migration;
  execution_log: ExecutionLog;
  created_at: Date;
  updated_at: Date;
}

const projectSchema = new Schema<ProjectDocument>(
  {
    region: { type: String, required: true, enum: constants.CS_REGIONS },
    org_id: { type: String, required: true },
    owner: { type: String, required: true },
    created_by: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: Boolean, default: true },
    migration: {
      name: { type: String },
      description: { type: String },
      created_at: { type: Date },
      updated_at: { type: Date },
      modules: {
        legacy_cms: {
          cms: { type: String },
          file_format: { type: String },
          import_data: { type: String },
        },
        destination_cms: {
          stack_id: { type: String },
          org_id: { type: String },
        },
        content_mapper: [
          { type: Schema.Types.ObjectId, ref: "ContentTypes Mapper" },
        ],
      },
    },
    execution_log: {
      log_url: { type: String },
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

const ProjectModel = model<ProjectDocument>("Project", projectSchema);

export default ProjectModel;
