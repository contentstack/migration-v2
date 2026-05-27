import path from 'path';
import fs from 'fs';
import { JSONFile } from 'lowdb/node';
import LowWithLodash from '../utils/lowdb-lodash.utils.js';
import { DB_CONFIG } from '../constants/index.js';

type AuditType = 'assets' | 'content_types' | 'entries' | 'global_fields';

type FlowIndex = {
  project_id: string;
  org_id: string;
  stack_id: string;
  created_at: string;
  updated_at: string;
  data_counts: Record<AuditType, number>;
};

type AuditIndexDocument = {
  projects: FlowIndex[];
};

type DataTypeIndex = {
  [key: string]: {
    file: string;
    uids: string[];
  };
};

const DATA_TYPES: AuditType[] = [
  'assets',
  'content_types',
  'entries',
  'global_fields',
];

const AUDIT_DIR = path.join(process.cwd(), DB_CONFIG.AUDIT_DIR);
const THRESHOLD = DB_CONFIG.AUDIT_THRESHOLD;

const defaultData: AuditIndexDocument = { projects: [] };

const auditIndexDb = new LowWithLodash(
  new JSONFile<AuditIndexDocument>(path.join(AUDIT_DIR, 'audit-index.json')),
  defaultData
);

const ensureProjectDir = (projectId: string) => {
  const projectDir = path.join(AUDIT_DIR, projectId);
  fs.mkdirSync(projectDir, { recursive: true });
  for (const dataType of DATA_TYPES) {
    const dataTypeDir = path.join(projectDir, dataType);
    fs.mkdirSync(dataTypeDir, { recursive: true });
    const indexPath = path.join(dataTypeDir, 'index.json');
    if (!fs.existsSync(indexPath)) {
      fs.writeFileSync(indexPath, JSON.stringify({}, null, 2));
    }
  }
};

const getUid = (item: any): string => {
  if (typeof item === 'string') return item;
  if (item?.uid) return String(item.uid);
  if (item?.entryUid) return String(item.entryUid);
  if (item?.id) return String(item.id);
  return JSON.stringify(item);
};

const readTypeIndex = async (
  projectId: string,
  dataType: AuditType
): Promise<DataTypeIndex> => {
  const indexPath = path.join(AUDIT_DIR, projectId, dataType, 'index.json');
  if (!fs.existsSync(indexPath)) return {};
  const raw = await fs.promises.readFile(indexPath, 'utf8');
  return JSON.parse(raw || '{}') as DataTypeIndex;
};

const writeTypeIndex = async (
  projectId: string,
  dataType: AuditType,
  index: DataTypeIndex
) => {
  const indexPath = path.join(AUDIT_DIR, projectId, dataType, 'index.json');
  await fs.promises.writeFile(indexPath, JSON.stringify(index, null, 2));
};

const writeSharded = async (
  projectId: string,
  dataType: AuditType,
  items: any[]
) => {
  ensureProjectDir(projectId);
  const typeDir = path.join(AUDIT_DIR, projectId, dataType);
  const existing = await readTypeIndex(projectId, dataType);

  for (const entry of Object.values(existing)) {
    const fp = path.join(typeDir, entry.file);
    if (fs.existsSync(fp)) fs.rmSync(fp, { force: true });
  }

  const nextIndex: DataTypeIndex = {};
  let shard = 0;
  for (let i = 0; i < items.length; i += THRESHOLD) {
    const chunk = items.slice(i, i + THRESHOLD);
    const file = `${dataType}-${shard + 1}.json`;
    await fs.promises.writeFile(
      path.join(typeDir, file),
      JSON.stringify(chunk, null, 2)
    );
    nextIndex[String(shard)] = {
      file,
      uids: chunk.map((item) => getUid(item)),
    };
    shard += 1;
  }
  await writeTypeIndex(projectId, dataType, nextIndex);
  return items.length;
};

const upsertAudit = async ({
  project_id,
  org_id,
  stack_id,
  assets = [],
  content_types = [],
  entries = [],
  global_fields = [],
}: {
  project_id: string;
  org_id: string;
  stack_id: string;
  assets?: any[];
  content_types?: any[];
  entries?: any[];
  global_fields?: any[];
}) => {
  await auditIndexDb.read();
  auditIndexDb.data ||= defaultData;

  let project = auditIndexDb.data.projects.find((p) => p.project_id === project_id);
  if (!project) {
    project = {
      project_id,
      org_id,
      stack_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      data_counts: {
        assets: 0,
        content_types: 0,
        entries: 0,
        global_fields: 0,
      },
    };
    auditIndexDb.data.projects.push(project);
  }

  project.org_id = org_id || project.org_id;
  project.stack_id = stack_id || project.stack_id;
  project.updated_at = new Date().toISOString();
  project.data_counts.assets = await writeSharded(project_id, 'assets', assets);
  project.data_counts.content_types = await writeSharded(
    project_id,
    'content_types',
    content_types
  );
  project.data_counts.entries = await writeSharded(project_id, 'entries', entries);
  project.data_counts.global_fields = await writeSharded(
    project_id,
    'global_fields',
    global_fields
  );

  await auditIndexDb.write();
  return project;
};

const getDataByType = async (projectId: string, dataType: AuditType) => {
  const index = await readTypeIndex(projectId, dataType);
  const allData: any[] = [];
  for (const entry of Object.values(index)) {
    const fp = path.join(AUDIT_DIR, projectId, dataType, entry.file);
    if (!fs.existsSync(fp)) continue;
    const raw = await fs.promises.readFile(fp, 'utf8');
    const parsed = JSON.parse(raw || '[]');
    if (Array.isArray(parsed)) allData.push(...parsed);
  }
  return allData;
};

const getAuditByProjectId = async (projectId: string) => {
  await auditIndexDb.read();
  auditIndexDb.data ||= defaultData;
  const metadata =
    auditIndexDb.data.projects.find((p) => p.project_id === projectId) || null;
  if (!metadata) return null;
  const assets = await getDataByType(projectId, 'assets');
  const content_types = await getDataByType(projectId, 'content_types');
  const entries = await getDataByType(projectId, 'entries');
  const global_fields = await getDataByType(projectId, 'global_fields');
  return { metadata, assets, content_types, entries, global_fields };
};

export default {
  upsertAudit,
  getDataByType,
  getAuditByProjectId,
};

