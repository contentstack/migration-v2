import ProjectModelLowdb from "../models/project-lowdb.js";
import ContentTypesMapperModelLowdb from "../models/contentTypesMapper-lowdb.js";
import FieldMapperModel from "../models/FieldMapper.js";
import { contenTypeMaker } from "./content-type-creator.utils.js";

function replaceDotsAfterFirst(word: string) {
  const firstDotIndex = word.indexOf('.');
  if (firstDotIndex === -1) return word; // no dots to replace

  const before = word.slice(0, firstDotIndex + 1); // keep first dot
  const after = word.slice(firstDotIndex + 1).replace(/\./g, '_'); // replace the rest

  return before + after;
}


function transformWord(prefix: string, word: string) {
  if (word?.startsWith?.('options')) {
    const newWord = `cm_${word}`;
    return newWord;
  }
  if (word?.includes('__')) {
    return word.replace(/^.*?__/, '.cm_').replace(/^_+|_+$/g, '').trim();
  }
  const hasIds = typeof word === 'string' && /(?:^|[._])ids\b/i.test(word);
  if (hasIds) {
    const newWord = `${word}_cm`;
    return newWord;
  }
  if (typeof word === 'string' && (word === 'id' || word?.includes('id.'))) {
    const newWord = `cm_${word}`;
    return newWord;
  }
  if (/^(?:[^.]*\.){2,}[^.]*$/.test(word)) {
    return replaceDotsAfterFirst(word)
  }
  return word;
}

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
          const newFieldUid = transformWord('cm_', field?.contentstackFieldUid);
          field.backupFieldUid = newFieldUid;
          field.contentstackFieldUid = newFieldUid;
          return field;
        })
      }
      await contenTypeMaker({ contentType, destinationStackId, projectId, newStack: projectData?.stackDetails?.isNewStack, keyMapper: projectData?.mapperKeys, region, user_id })
      contentTypes?.push?.(contentType);
    }
  }
  return contentTypes;
}