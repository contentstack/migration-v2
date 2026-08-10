/* eslint-disable */

import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { CS_REGIONS } from '../constants/index.js';
import AuthenticationModel from '../models/authentication.js';
import { setLogFilePath } from '../server.js';
// import utilitiesHandler from '@contentstack/cli-utilities';
import { setOAuthConfig } from '../utils/config-handler.util.js';
import { setBasicAuthConfig } from '../utils/config-handler.util.js';

const determineLogLevel = (text: string): string => {
  const lowerText = text.toLowerCase();

  if (
    lowerText.includes('error') ||
    lowerText.includes('failed') ||
    lowerText.includes('exception') ||
    lowerText.includes('not found')
  ) {
    return 'error';
  } else if (lowerText.includes('warn') || lowerText.includes('warning')) {
    return 'warn';
  } else {
    return 'info';
  }
};

const stripAnsiCodes = (text: string): string => {
  return text.replace(/\u001b\[\d+m/g, '');
};

const runCommand = (
  command: string,
  args: string[] = [],
  logFilePath?: string,
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    // See runCli.service.ts: pipe stdio explicitly so a stale parent descriptor
    // can't make spawn fail with EBADF.
    const cmdProcess = spawn(command, args, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Without this, a spawn failure would leave the promise pending forever.
    cmdProcess.on('error', (err) => {
      if (logFilePath) {
        try {
          fs.appendFileSync(
            logFilePath,
            JSON.stringify({
              level: 'error',
              message: `Failed to start command "${command}": ${err.message}`,
              timestamp: new Date().toISOString(),
            }) + '\n'
          );
        } catch {
          /* logging must not mask the spawn failure */
        }
      }
      reject(err);
    });

    cmdProcess.stdout.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(output);

      if (logFilePath) {
        try {
          const cleanedOutput = stripAnsiCodes(output);
          const logEntry = {
            level: determineLogLevel(cleanedOutput),
            message: cleanedOutput.trim(),
            timestamp: new Date().toISOString(),
          };
          fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + '\n');
        } catch (err) {
          console.error('Error writing to log file:', err);
        }
      }
    });

    cmdProcess.stderr.on('data', (data) => {
      const output = data.toString();
      process.stderr.write(output);

      if (logFilePath) {
        try {
          const cleanedOutput = stripAnsiCodes(output);
          const logEntry = {
            level: 'error',
            message: cleanedOutput.trim(),
            timestamp: new Date().toISOString(),
          };
          fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + '\n');
        } catch (err) {
          console.error('Error writing stderr to log file:', err);
        }
      }
    });

    cmdProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        if (logFilePath) {
          try {
            const logEntry = {
              level: 'error',
              message: `Command failed with exit code ${code}`,
              timestamp: new Date().toISOString(),
            };
            fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + '\n');
          } catch (err) {
            console.error('Error writing close event to log file:', err);
          }
        }
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
  });
};

/**
 * Runs csdx cm:stacks:migration to execute the entry update script
 * against the target stack.
 */
export const updateEntryCli = async (
  rg: string,
  user_id: string,
  stack_api_key: string,
  logFilePath: string,
  configFilePath: string
) => {
  try {
    console.info("inside updateEntryCli");
    const regionPresent =
      CS_REGIONS.find((item) => item === rg) ?? 'NA'.replace(/_/g, '-');
    const regionCli = regionPresent.replace(/_/g, '-');
    
    const directLogEntry1 = {
      level: 'info',
      message: `Starting entry update CLI process for stack: ${stack_api_key}`,
      methodName: 'updateEntryCli',
      timestamp: new Date().toISOString(),
    };
    fs.appendFileSync(logFilePath, JSON.stringify(directLogEntry1) + '\n');

    await AuthenticationModel.read();
    const userData = AuthenticationModel.chain
      .get('users')
      .find({ region: regionPresent, user_id })
      .value();

    await runCommand(
      'npx',
      ['@contentstack/cli', 'config:set:region', regionCli],
      logFilePath
    );

    // utilitiesHandler.configHandler.set('authtoken', userData.authtoken);
    // utilitiesHandler.configHandler.set('email', userData.email);
    // utilitiesHandler.configHandler.set('authorisationType', 'BASIC');
    if(userData?.access_token){
      setOAuthConfig(userData);

    }else if(userData?.authtoken){
      setBasicAuthConfig(userData);
    }else {
      throw new Error("No authentication token found");
    }
    const hasAuth = Boolean(userData?.authtoken || userData?.access_token);
    if (!hasAuth || !stack_api_key) {
      const directLogEntry2 = {
        level: 'info',
        message: 'User not found, no auth token (authtoken or access_token), or stack API key missing.',
        methodName: 'updateEntryCli',
        timestamp: new Date().toISOString(),
      };
      fs.appendFileSync(logFilePath, JSON.stringify(directLogEntry2) + '\n');
      return;
    }
    
    const directLogEntry3 = {
      level: 'info',
      message: `Authentication configured for user: ${userData?.email}`,
      methodName: 'updateEntryCli',
      timestamp: new Date().toISOString(),
    };
    fs.appendFileSync(logFilePath, JSON.stringify(directLogEntry3) + '\n');

    const scriptPath = path.join(
      process.cwd(),
      'src',
      'utils',
      'entry-update-script.cjs'
    );
    const directLogEntryScript = {
      level: 'info',
      message: `Script path: ${scriptPath}`,
      methodName: 'updateEntryCli',
      timestamp: new Date().toISOString(),
    };
    fs.appendFileSync(logFilePath, JSON.stringify(directLogEntryScript) + '\n');

    await setLogFilePath(logFilePath);

    const directLogEntry4 = {
      level: 'info',
      message: 'Running update entry migration script',
      methodName: 'updateEntryCli',
      timestamp: new Date().toISOString(),
    };
    fs.appendFileSync(logFilePath, JSON.stringify(directLogEntry4) + '\n');
    
    const directLogEntry5 = {
      level: 'info',
      message: `Updating entries using config file: ${configFilePath}`,
      methodName: 'updateEntryCli',
      timestamp: new Date().toISOString(),
    };
    fs.appendFileSync(logFilePath, JSON.stringify(directLogEntry5) + '\n');

    await runCommand(
      'npx',
      [
        '@contentstack/cli',
        'cm:stacks:migration',
        '--file-path',
        scriptPath.includes(' ') ? `"${scriptPath}"` : scriptPath, 
        '-k',
        stack_api_key,
        '--config-file',
        configFilePath.includes(' ') ? `"${configFilePath}"` : configFilePath,
      ],
      logFilePath,
    );

    const directLogEntry6 = {
      level: 'info',
      message: 'Entry update migration completed successfully',
      methodName: 'updateEntryCli',
      timestamp: new Date().toISOString(),
    };
    fs.appendFileSync(logFilePath, JSON.stringify(directLogEntry6) + '\n');
    
    const directLogEntry7 = {
      level: 'info',
      message: `All entries have been updated in Contentstack stack: ${stack_api_key}`,
      methodName: 'updateEntryCli',
      timestamp: new Date().toISOString(),
    };
    fs.appendFileSync(logFilePath, JSON.stringify(directLogEntry7) + '\n');

    const directLogEntry = {
      level: 'info',
      message: 'Entry Update Process Completed',
      methodName: 'updateEntryCli',
      timestamp: new Date().toISOString(),
    };
    fs.appendFileSync(logFilePath, JSON.stringify(directLogEntry) + '\n');
  } catch (error) {
    console.error('updateEntryCli error:', error);
    const directLogEntry8 = {
      level: 'error',
      message: `Failed to update entries for stack: ${stack_api_key}`,
      methodName: 'updateEntryCli',
      timestamp: new Date().toISOString(),
    };
    fs.appendFileSync(logFilePath, JSON.stringify(directLogEntry8) + '\n');
  }
};

export const utilsUpdateCli = { updateEntryCli };
