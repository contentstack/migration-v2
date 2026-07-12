import fs from 'fs';
import path from 'path';
import { MIGRATION_DATA_CONFIG } from '../../constants/index.js';

const { DATA, EXPORT_INFO_FILE } = MIGRATION_DATA_CONFIG;

export async function createVersionFile(destinationStackId: string, _projectId: string): Promise<void> {
  await fs.promises.writeFile(
    path.join(DATA, destinationStackId, EXPORT_INFO_FILE),
    JSON.stringify({ contentVersion: 2, logsPath: '' }, null, 4),
    'utf-8',
  );
}
