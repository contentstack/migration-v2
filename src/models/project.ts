import { Schema, model, Document } from "mongoose";
import { constants } from "../constants";

interface LegacyCMS {
  cms: string;
  file_format: string;
  import_data: string;
}

interface ExecutionLog {
  log_url: string;
  date: Date;
}

interface ProjectDocument extends Document {
  region: string;
  org_id: string;
  owner: string;
  created_by: string;
  updated_by: string;
  former_owner_ids: [];
  name: string;
  description: string;
  status: boolean;
  destination_stack_id: string;
  legacy_cms: LegacyCMS;
  content_mapper: [];
  execution_log: [ExecutionLog];
  created_at: Date;
  updated_at: Date;
}

const projectSchema = new Schema<ProjectDocument>(
  {
    region: { type: String, required: true, enum: constants.CS_REGIONS },
    org_id: { type: String, required: true },
    owner: { type: String, required: true },
    created_by: { type: String, required: true },
    updated_by: { type: String },
    former_owner_ids: [{ type: String }],
    name: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: Boolean, default: true },
    destination_stack_id: { type: String },
    legacy_cms: {
      cms: { type: String },
      file_format: { type: String },
      import_data: { type: String },
    },
    content_mapper: [
      { type: Schema.Types.ObjectId, ref: "ContentTypes Mapper" },
    ],
    execution_log: [
      {
        log_url: { type: String },
        date: { type: Date },
      },
    ],
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

const ProjectModel = model<ProjectDocument>("Project", projectSchema);

export default ProjectModel;
