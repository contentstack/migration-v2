import { Schema, model, Document } from "mongoose";

interface ContentTypesMapper extends Document {
  otherCmsTitle: string;
  otherCmsUid: string;
  isUpdated: boolean;
  updateAt: Date;
  contentstackTitle: string;
  contentstackUid: string;
  fieldMapping: [];
}

const contentTypesMapperSchema = new Schema<ContentTypesMapper>({
  otherCmsTitle: { type: String, required: true },
  otherCmsUid: { type: String, required: true },
  isUpdated: { type: Boolean, default: false },
  updateAt: { type: Date },
  contentstackTitle: { type: String },
  contentstackUid: { type: String },
  fieldMapping: [{ type: Schema.Types.ObjectId, ref: "FieldMapping" }],
});

const ContentTypesMapperModel = model<ContentTypesMapper>(
  "ContentTypes Mapper",
  contentTypesMapperSchema
);

export default ContentTypesMapperModel;
