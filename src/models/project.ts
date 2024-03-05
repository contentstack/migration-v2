import { Schema, model, Document } from "mongoose";
import {
  CS_REGIONS,
  PREDEFINED_STATUS,
  PREDEFINED_STEPS,
  PROJECT_STATUS,
  STEPPER_STEPS,
} from "../constants";

interface LegacyCMS {
  cms: string;
  affix: string;
  affix_confirmation: boolean;
  file_format: string;
  file_format_confirmation: boolean;
  file: {
    id: string;
    name: string;
    size: number;
    type: string;
    path: string;
  };
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
  status: string;
  current_step: number;
  destination_stack_id: string;
  legacy_cms: LegacyCMS;
  content_mapper: [];
  execution_log: [ExecutionLog];
  created_at: Date;
  updated_at: Date;
}

const projectSchema = new Schema<ProjectDocument>(
  {
    region: { type: String, required: true, enum: CS_REGIONS },
    org_id: { type: String, required: true },
    owner: { type: String, required: true },
    created_by: { type: String, required: true },
    updated_by: { type: String },
    former_owner_ids: [{ type: String }],
    name: { type: String, required: true },
    description: { type: String, required: true },
    status: {
      type: String,
      required: true,
      default: PROJECT_STATUS.DRAFT,
      enum: PREDEFINED_STATUS,
    },
    current_step: {
      type: Number,
      required: true,
      default: STEPPER_STEPS.LEGACY_CMS,
      enum: PREDEFINED_STEPS,
    },
    destination_stack_id: { type: String },
    legacy_cms: {
      cms: { type: String },
      affix: { type: String },
      affix_confirmation: { type: Boolean },
      file_format: { type: String },
      file_format_confirmation: { type: Boolean },
      file: {
        id: { type: String },
        name: { type: String },
        size: { type: String },
        type: { type: String },
        path: { type: String },
      },
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
