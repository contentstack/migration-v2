import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { CS_REGIONS } from '../constants/index.js';
import AuthenticationModel from '../models/authentication.js';
import { setBasicAuthConfig } from '../utils/config-handler.util.js';
import logger from '../utils/logger.js';

const stripAnsiCodes = (input: string): string =>
  input.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

// Default 30-minute cap on any single CLI invocation. Large stacks legitimately
// take many minutes to export, but a stuck child process should not hold an
// API request open indefinitely. Overridable via EXPORT_CLI_TIMEOUT_MS.
const DEFAULT_CLI_TIMEOUT_MS = 30 * 60 * 1000;

const runCommand = (command: string, args: string[] = []): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    logger.info(`[exportCli] running: ${command} ${args.join(' ')}`);
    // Pipe stdout/stderr through the project logger instead of inheriting the
    // server's stdio, so CLI output doesn't intermix with structured API logs
    // or leak identifiers to the raw server stream.
    const cmd = spawn(command, args, { shell: true, stdio: 'pipe' });
    let stderrBuffer = '';
    let settled = false;

    const timeoutMs =
      Number(process.env.EXPORT_CLI_TIMEOUT_MS) || DEFAULT_CLI_TIMEOUT_MS;
    const timeoutHandle = setTimeout(() => {
      if (settled) return;
      settled = true;
      logger.error(
        `[exportCli] timed out after ${timeoutMs}ms — killing child process`
      );
      try {
        cmd.kill('SIGTERM');
        // Force-kill if SIGTERM doesn't take effect within 5s.
        setTimeout(() => {
          try {
            cmd.kill('SIGKILL');
          } catch {
            // process may already be gone
          }
        }, 5000).unref();
      } catch {
        // ignore kill failures
      }
      reject(new Error(`Command timed out after ${timeoutMs}ms: ${command}`));
    }, timeoutMs);
    timeoutHandle.unref();

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      fn();
    };

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

    cmd.on('error', (err) => finish(() => reject(err)));
    cmd.on('close', (code) => {
      finish(() => {
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
  });

export const exportStackCli = async (
  stackId: string,
  region: string,
  user_id: string,
  iteration: number = 1
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

    // Per-iteration export folder so delta runs don't clobber prior baselines.
    const iterationSegment = String(iteration > 0 ? iteration : 1);
    const outputPath = path.join(
      process.cwd(),
      'export-stack',
      stackId,
      iterationSegment
    );
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

