import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { CS_REGIONS } from '../constants/index.js';
import AuthenticationModel from '../models/authentication.js';
import { setBasicAuthConfig } from '../utils/config-handler.util.js';
import logger from '../utils/logger.js';

const stripAnsiCodes = (input: string): string =>
  input.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

const runCommand = (command: string, args: string[] = []): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    logger.info(`[exportCli] running: ${command} ${args.join(' ')}`);
    // Pipe stdout/stderr through the project logger instead of inheriting the
    // server's stdio, so CLI output doesn't intermix with structured API logs
    // or leak identifiers to the raw server stream.
    const cmd = spawn(command, args, { shell: true, stdio: 'pipe' });
    let stderrBuffer = '';

    cmd?.stdout?.on('data', (data) => {
      const text = stripAnsiCodes(data.toString()).trim();
      if (text) logger.info(`[exportCli] ${text}`);
    });

    cmd?.stderr?.on('data', (data) => {
      const text = stripAnsiCodes(data.toString()).trim();
      if (text) {
        stderrBuffer += text + '\n';
        logger.warn(`[exportCli] ${text}`);
      }
    });

    cmd.on('error', (err) => reject(err));
    cmd.on('close', (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `Command failed with exit code ${code}${
              stderrBuffer ? `: ${stderrBuffer.trim()}` : ''
            }`
          )
        );
    });
  });

export const exportStackCli = async (
  stackId: string,
  region: string,
  user_id: string
) => {
  try {
    const regionPresent = CS_REGIONS.find((item) => item === region) ?? 'NA';
    const regionCli = regionPresent.replace(/_/g, '-');

    // Fetch user authentication data
    await AuthenticationModel.read();
    const userData = AuthenticationModel.chain
      .get('users')
      .find({ region: regionPresent, user_id })
      .value();

    if (!userData) {
      throw new Error('User not found');
    }

    // Configure CLI with region settings
    await runCommand('npx', ['@contentstack/cli', 'config:set:region', regionCli]);

    // Set up authentication configuration for CLI
    setBasicAuthConfig(userData);

    const outputPath = path.join(process.cwd(), 'export-stack', stackId);
    if (fs.existsSync(outputPath)) {
      fs.rmSync(outputPath, { recursive: true, force: true });
    }
    fs.mkdirSync(outputPath, { recursive: true });

    await runCommand('npx', [
      '@contentstack/cli',
      'cm:stacks:export',
      '-k',
      stackId,
      '-d',
      outputPath,
      '--yes'
    ]);

    return outputPath;
  } catch (error) {
    logger.error('Error exporting stack', {
      message: (error as Error)?.message,
    });
    throw error;
  }
};

