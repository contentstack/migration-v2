import getEntryMapperDb from "../models/EntryMapper.js";
import ProjectModelLowdb from "../models/project-lowdb.js";

export const isDuplicateEntry = async (projectId: string) => {
    await ProjectModelLowdb.read();
    const projectData = ProjectModelLowdb.chain
        .get("projects")
        .find({ id: projectId })
        .value();
    const iteration = projectData?.iteration || 1;
    const entryMapper = getEntryMapperDb(projectId, iteration);
    await entryMapper.read();
    // const entryMapperData = entryMapper.chain.get("entry_mapper").value();
    const seen = new Map();

    await entryMapper.update((data: any) => {
        data?.entry_mapper?.forEach((item: any, index: number) => {
        const key = `${item.contentTypeId}_${item.language}_${item.entryName}`;

        if (seen.has(key)) {
            const firstIndex = seen.get(key);
            data.entry_mapper[firstIndex].isDuplicateEntry = true;
            item.isDuplicateEntry = true;
        }
        else{
            seen.set(key, index);
        }
        });
    });
};