import { Schema, model, Document } from "mongoose";

interface FieldMapper extends Document {
  uid: string;
  otherCmsField: string;
  otherCmsType: string;
  contentstackField: string;
  contentstackFieldUid: string;
  ContentstackFieldType: string;
  isDeleted: boolean;
  backupFieldType: string;
  refrenceTo: { uid: string; title: string };
}

const fieldMapperSchema = new Schema<FieldMapper>({
  uid: { type: String, required: true },
  otherCmsField: { type: String, required: true },
  otherCmsType: { type: String, required: true },
  contentstackField: { type: String },
  contentstackFieldUid: { type: String },
  ContentstackFieldType: { type: String, required: true },
  isDeleted: { type: Boolean, default: false },
  backupFieldType: { type: String },
  refrenceTo: {
    uid: { type: String },
    title: { type: String },
  },
});

const FieldMapperModel = model<FieldMapper>("FieldMapping", fieldMapperSchema);

export default FieldMapperModel;
