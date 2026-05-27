import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { CS_REGIONS } from '../constants/index.js';
import AuthenticationModel from '../models/authentication.js';
import { setBasicAuthConfig } from '../utils/config-handler.util.js';

const runCommand = (command: string, args: string[] = []): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    console.log(`[exportCli] $ ${command} ${args.join(' ')}`);
    // stdio: 'inherit' streams the CLI's stdout/stderr directly to the parent
    // process terminal so progress is visible during long-running exports.
    const cmd = spawn(command, args, { shell: true, stdio: 'inherit' });

    cmd.on('error', (err) => reject(err));
    cmd.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with exit code ${code}`));
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
    console.error('Error exporting stack:', error);
    throw error;
  }
};

