import ProjectModelLowdb from "../models/project-lowdb.js";
import ContentTypesMapperModelLowdb from "../models/contentTypesMapper-lowdb.js";
import FieldMapperModel from "../models/FieldMapper.js";
import { contenTypeMaker } from "./content-type-creator.utils.js";

export const fieldAttacher = async ({ projectId, orgId, destinationStackId, region, user_id }: any) => {
  await ProjectModelLowdb.read();
  const projectData: any = ProjectModelLowdb.chain.get("projects").find({
    id: projectId,
    org_id: orgId,
  }).value()
  await ContentTypesMapperModelLowdb.read();
  await FieldMapperModel.read();
  const contentTypes = [];
  if (projectData?.content_mapper?.length) {
    for await (const contentId of projectData?.content_mapper ?? []) {
      const contentType: any = ContentTypesMapperModelLowdb.chain
        .get("ContentTypesMappers")
        .find({ id: contentId, projectId: projectId })
        .value();
      if (contentType?.fieldMapping?.length) {
        contentType.fieldMapping = contentType?.fieldMapping?.map((fieldUid: any) => {
          const field = FieldMapperModel.chain
            .get("field_mapper")
            .find({ id: fieldUid, projectId: projectId })
            .value()
          return field;
        })
      }
      await contenTypeMaker({ contentType, destinationStackId, projectId, newStack: projectData?.stackDetails?.isNewStack, keyMapper: projectData?.mapperKeys, region, user_id })
      contentTypes?.push?.(contentType);
    }
  }
  return contentTypes;
}