import path from "path";
import fs from 'fs';
import shell from 'shelljs'
import { v4 } from "uuid";
import { copyDirectory, createDirectoryAndFile } from '../utils/index.js'
import { CS_REGIONS, MIGRATION_DATA_CONFIG } from "../constants/index.js";
import ProjectModelLowdb from "../models/project-lowdb.js";
import AuthenticationModel from "../models/authentication.js";
import watchLogs from "../utils/watch.utils.js";
import { setLogFilePath } from "../server.js";

const addCustomMessageInCliLogs = async (loggerPath: string, level: string = 'info', message: string) => {
  try {
    const logEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
    };
    const logMessage = JSON.stringify(logEntry) + '\n'; // Convert to JSON and add a newline
    await fs.promises.appendFile(loggerPath, logMessage);
  } catch (error) {
    console.error('Error reading the file:', error);
  }
}

export const runCli = async (rg: string, user_id: string, stack_uid: any, projectId: string, isTest = false, transformePath: string) => {
  try {
    const message: string =  isTest ? 'Test Migration Process Completed' : 'Migration Process Completed'
    const regionPresent = CS_REGIONS?.find((item: string) => item === rg) ?? 'NA';
    await AuthenticationModel.read();
    const userData = AuthenticationModel.chain
      .get("users")
      .find({ region: regionPresent, user_id })
      .value();
    if (userData?.authtoken && stack_uid) {
      const { BACKUP_DATA, BACKUP_LOG_DIR, BACKUP_FOLDER_NAME, BACKUP_FILE_NAME}  = MIGRATION_DATA_CONFIG;
      const sourcePath = path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, stack_uid);
      const backupPath = path.join(process.cwd(), BACKUP_DATA, `${stack_uid}_${v4().slice(0, 4)}`);
      await copyDirectory(sourcePath, backupPath);
      const loggerPath = path.join(backupPath, BACKUP_LOG_DIR, BACKUP_FOLDER_NAME, BACKUP_FILE_NAME);
      await createDirectoryAndFile(loggerPath, transformePath);
      await setLogFilePath(loggerPath);
      await watchLogs(loggerPath, transformePath);
      shell.cd(path.join(process.cwd(), '..', 'cli', 'packages', 'contentstack'));
      shell.exec(`node bin/run config:set:region ${regionPresent}`);
      shell.exec(`node bin/run login -a ${userData?.authtoken}  -e ${userData?.email}`);
      const importData = shell.exec(`node bin/run cm:stacks:import  -k ${stack_uid} -d ${sourcePath} --backup-dir=${backupPath}  --yes`, { async: true });
      importData.on('exit', async (code) => {
        console.info(`Process exited with code: ${code}`);
        if (code === 1 || code === 0) {
          const projectIndex = ProjectModelLowdb.chain.get("projects").findIndex({ id: projectId }).value();
          if (projectIndex > -1 && isTest) {
            ProjectModelLowdb?.data?.projects?.[projectIndex]?.test_stacks?.map((item: any) => {
              if (item?.stackUid === stack_uid) {
                item.isMigrated = true;
              }
              return item;
            })
            ProjectModelLowdb.write();
          }
          await addCustomMessageInCliLogs(loggerPath, 'info', message);
        }
      });

    } else {
      console.info('user not found.')
    }
  } catch (er) {
    console.error("🚀 ~ runCli ~ er:", er)
  }
}


export const utilsCli = {
  runCli
};