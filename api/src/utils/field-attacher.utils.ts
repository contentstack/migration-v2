import ProjectModelLowdb from "../models/project-lowdb.js";
import getContentTypesMapperDb from "../models/contentTypesMapper-lowdb.js";
import getFieldMapperDb from "../models/FieldMapper.js";
import { contenTypeMaker } from "./content-type-creator.utils.js";
import { shouldSkipContentTypeCreation } from "./content-type-checker.utils.js";

export const fieldAttacher = async ({ projectId, orgId, destinationStackId, region, user_id, is_sso }: any) => {
  await ProjectModelLowdb.read();
  const projectData: any = ProjectModelLowdb.chain.get("projects").find({
    id: projectId,
    org_id: orgId,
  }).value()
  const iteration = projectData?.iteration || 1;
  const ContentTypesMapperModelLowdb = getContentTypesMapperDb(projectId, iteration);
  const FieldMapperModel = getFieldMapperDb(projectId, iteration);
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
            .find({ id: fieldUid, contentTypeId: contentId, projectId: projectId })
            .value()
          return field;
        })
      }
      // await contenTypeMaker({ contentType, destinationStackId, projectId, newStack: projectData?.stackDetails?.isNewStack, keyMapper: projectData?.mapperKeys, region, user_id, is_sso })
      if (iteration === 1) {
        await contenTypeMaker({ contentType, destinationStackId, projectId, newStack: projectData?.stackDetails?.isNewStack, keyMapper: projectData?.mapperKeys, region, user_id, is_sso })

      }
      else {
        const shouldSkip = await shouldSkipContentTypeCreation(projectId, contentType.otherCmsUid, iteration);
        if (!shouldSkip) {
          console.info(`Creating new content type: ${contentType.otherCmsUid}`);
          await contenTypeMaker({ contentType, destinationStackId, projectId, newStack: projectData?.stackDetails?.isNewStack, keyMapper: projectData?.mapperKeys, region, user_id, is_sso })
        } else {
          console.info(`Skipping content type creation: ${contentType.otherCmsUid} (already exists from previous iteration)`);
        }
      }
      contentTypes?.push?.(contentType);
    }
  }
  return contentTypes;
}