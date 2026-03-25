/* eslint-disable */

import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { CS_REGIONS } from '../constants/index.js';
import AuthenticationModel from '../models/authentication.js';
import { setLogFilePath } from '../server.js';
import utilitiesHandler from '@contentstack/cli-utilities';

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
    const cmdProcess = spawn(command, args, { shell: true });

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
        // reject(new Error(`Command failed with exit code ${code}`));
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
    const regionPresent =
      CS_REGIONS.find((item) => item === rg) ?? 'NA'.replace(/_/g, '-');
    const regionCli = regionPresent.replace(/_/g, '-');

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

    utilitiesHandler.configHandler.set('authtoken', userData.authtoken);
    utilitiesHandler.configHandler.set('email', userData.email);
    utilitiesHandler.configHandler.set('authorisationType', 'BASIC');

    if (!userData?.authtoken || !stack_api_key) {
      console.info('User not found or stack API key missing.');
      return;
    }

    const scriptPath = path.join(
      process.cwd(),
      'src',
      'utils',
      'entry-update-script.cjs'
    );
    console.info('scriptPath', scriptPath);

    await setLogFilePath(logFilePath);

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

    // console.info('Entry update migration completed successfully');

    const directLogEntry = {
      level: 'info',
      message: 'Entry Update Process Completed',
      timestamp: new Date().toISOString(),
    };
    fs.appendFileSync(logFilePath, JSON.stringify(directLogEntry) + '\n');
  } catch (error) {
    console.error('updateEntryCli error:', error);
  }
};

export const utilsUpdateCli = { updateEntryCli };
