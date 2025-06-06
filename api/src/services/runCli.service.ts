import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { v4 } from "uuid";
import { copyDirectory, createDirectoryAndFile } from "../utils/index.js";
import { CS_REGIONS, MIGRATION_DATA_CONFIG } from "../constants/index.js";
import ProjectModelLowdb from "../models/project-lowdb.js";
import AuthenticationModel from "../models/authentication.js";
// import watchLogs from '../utils/watch.utils.js';
import { setLogFilePath } from "../server.js";

/**
 * Represents a test stack with migration status
 */
interface TestStack {
  stackUid: string;
  isMigrated: boolean;
}
import utilitiesHandler from "@contentstack/cli-utilities";

/**
 * Determines log level based on message content without removing ANSI codes
 */
const determineLogLevel = (text: string): string => {
  const lowerText = text.toLowerCase();

  // Check for errors first - be more aggressive in detection
  if (
    lowerText.includes("error") ||
    lowerText.includes("failed") ||
    lowerText.includes("exception") ||
    lowerText.includes("not found")
  ) {
    return "error";
  }
  // Then check for warnings
  else if (lowerText.includes("warn") || lowerText.includes("warning")) {
    return "warn";
  }
  // Default to info
  else {
    return "info";
  }
};

/**
 * Strips ANSI color codes from text to create clean logs
 */
const stripAnsiCodes = (text: string): string => {
  const ESC = "\u001b";
  // This regex removes all ANSI escape sequences (color codes)
  return text.replace(new RegExp(`${ESC}\\[[0-9;]*m`, "g"), "");
};

/**
 * Executes CLI commands and provides real-time output
 * Uses Node's spawn to run commands asynchronously
 */
const runCommand = (
  command: string,
  args: string[] = [],
  logFilePath?: string
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const cmdProcess = spawn(command, args, { shell: true });

    // For stdout handler
    cmdProcess.stdout.on("data", (data) => {
      const output = data.toString();
      process.stdout.write(output); // Keep colors in console

      if (logFilePath) {
        try {
          // Clean the output by removing ANSI color codes
          const cleanedOutput = stripAnsiCodes(output);
          const logLevel = determineLogLevel(cleanedOutput);
          const logEntry = {
            level: logLevel,
            message: cleanedOutput.trim(),
            timestamp: new Date().toISOString(),
          };
          fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + "\n");
        } catch (err) {
          console.error("Error writing to log file:", err);
        }
      }
    });

    // For stderr handler
    cmdProcess.stderr.on("data", (data) => {
      const output = data.toString();
      process.stderr.write(output); // Keep colors in console

      if (logFilePath) {
        try {
          // Clean the output by removing ANSI color codes
          const cleanedOutput = stripAnsiCodes(output);
          const logEntry = {
            level: "error",
            message: cleanedOutput.trim(),
            timestamp: new Date().toISOString(),
          };
          fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + "\n");
        } catch (err) {
          console.error("Error writing stderr to log file:", err);
        }
      }
    });

    cmdProcess.on("close", (code) => {
      if (code === 0) resolve();
      else {
        // Log the error to the log file
        if (logFilePath) {
          try {
            const logEntry = {
              level: "error",
              message: `Command failed with exit code ${code}`,
              timestamp: new Date().toISOString(),
            };
            fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + "\n");
          } catch (err) {
            console.error("Error writing close event to log file:", err);
          }
        }
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
  });
};

/**
 * Main CLI execution function for content migration
 * @param rg - Region identifier
 * @param user_id - User ID
 * @param stack_uid - Stack UID
 * @param projectId - Project ID
 * @param isTest - Flag to indicate if this is a test migration
 * @param transformePath - Path to transform configuration
 */
export const runCli = async (
  rg: string,
  user_id: string,
  stack_uid: string,
  projectId: string,
  isTest = false,
  transformePath: string
) => {
  try {
    // Format region string for CLI compatibility
    const regionPresent =
      CS_REGIONS.find((item) => item === rg) ?? "NA".replace(/_/g, "-");
    const regionCli = regionPresent.replace(/_/g, "-");

    // Fetch user authentication data
    await AuthenticationModel.read();
    const userData = AuthenticationModel.chain
      .get("users")
      .find({ region: regionPresent, user_id })
      .value();

    // Configure CLI with region settings
    await runCommand(
      "npx",
      ["@contentstack/cli", "config:set:region", `${regionCli}`],
      transformePath
    ); // Pass the log file path here

    // Set up authentication configuration for CLI
    utilitiesHandler.configHandler.set("authtoken", userData.authtoken);
    utilitiesHandler.configHandler.set("email", userData.email);
    utilitiesHandler.configHandler.set("authorisationType", "BASIC");

    if (userData?.authtoken && stack_uid) {
      // Set up paths for backup and source data
      const {
        BACKUP_DATA,
        BACKUP_LOG_DIR,
        BACKUP_FOLDER_NAME,
        BACKUP_FILE_NAME,
      } = MIGRATION_DATA_CONFIG;

      // Create source and backup paths
      const sourcePath = path.join(
        process.cwd(),
        MIGRATION_DATA_CONFIG.DATA,
        stack_uid
      );
      const backupPath = path.join(
        process.cwd(),
        BACKUP_DATA,
        `${stack_uid}_${v4().slice(0, 4)}`
      );

      // Create backup of source data
      await copyDirectory(sourcePath, backupPath);

      // Set up logging
      const loggerPath = path.join(
        backupPath,
        BACKUP_LOG_DIR,
        BACKUP_FOLDER_NAME,
        BACKUP_FILE_NAME
      );
      await createDirectoryAndFile(loggerPath, transformePath);

      // Debug which log path is being used
      console.info(`Log path for CLI commands: ${transformePath}`);

      // Test writing all log levels directly to the file
      try {
        const testLogs = [
          {
            level: "info",
            message: "TEST INFO LOG",
            timestamp: new Date().toISOString(),
          },
          {
            level: "warn",
            message: "TEST WARNING LOG",
            timestamp: new Date().toISOString(),
          },
          {
            level: "error",
            message: "TEST ERROR LOG",
            timestamp: new Date().toISOString(),
          },
        ];

        for (const log of testLogs) {
          fs.appendFileSync(transformePath, JSON.stringify(log) + "\n");
        }
        console.info("Test logs written successfully");
      } catch (err) {
        console.error("Failed to write test logs:", err);
      }

      // Make sure to set the global.currentLogFile to the project log file
      // This is the key part - setting the log file path to the migration service log file
      await setLogFilePath(transformePath);
      // Comment out the watchLogs call to see if that's causing the issue
      // await watchLogs(loggerPath, transformePath);

      // Execute the stack import command
      await runCommand(
        "npx",
        [
          "@contentstack/cli",
          "cm:stacks:import",
          "-k",
          stack_uid,
          "-d",
          sourcePath.includes(" ") ? `"${sourcePath}"` : sourcePath,
          "--backup-dir",
          backupPath.includes(" ") ? `"${backupPath}"` : backupPath,
          "--yes",
        ],
        transformePath
      ); // Pass the log file path here

      // After the import command completes
      console.info("Import command completed successfully");

      // Write the completion message ONCE in the format the UI expects
      if (isTest) {
        const directLogEntry = {
          level: "info",
          message: "Test Migration Process Completed",
          timestamp: new Date().toISOString(),
        };

        // Write to the transform path (main log file) - ONLY ONCE
        fs.appendFileSync(
          transformePath,
          JSON.stringify(directLogEntry) + "\n"
        );

        // Also write to backup log path if different
        if (loggerPath && loggerPath !== transformePath) {
          fs.appendFileSync(loggerPath, JSON.stringify(directLogEntry) + "\n");
        }

        console.info("Added test completion message to logs");
      } else {
        const directLogEntry = {
          level: "info",
          message: "Migration Process Completed",
          timestamp: new Date().toISOString(),
        };

        // Write to the transform path (main log file) - ONLY ONCE
        fs.appendFileSync(
          transformePath,
          JSON.stringify(directLogEntry) + "\n"
        );

        // Also write to backup log path if different
        if (loggerPath && loggerPath !== transformePath) {
          fs.appendFileSync(loggerPath, JSON.stringify(directLogEntry) + "\n");
        }

        console.info("Added migration completion message to logs");
      }

      // Keep the project status update code:
      console.info(
        `Updating project status: projectId=${projectId}, isTest=${isTest}`
      );
      // ... rest of the code ...

      // Add debug logs to track project index and test flag
      console.info(
        `Updating project status: projectId=${projectId}, isTest=${isTest}`
      );

      // Make sure we have the latest data
      await ProjectModelLowdb.read();
      const projectIndex = ProjectModelLowdb.chain
        .get("projects")
        .findIndex({ id: projectId })
        .value();

      console.info(`Found project index: ${projectIndex}`);

      // Debug: Log the full project data to verify it exists
      try {
        const project = ProjectModelLowdb.chain
          .get("projects")
          .find({ id: projectId })
          .value();
        console.info(`Project found: ${project ? "Yes" : "No"}`);
        if (project) {
          console.info(
            `Current migration status: started=${project.isMigrationStarted}, completed=${project.isMigrationCompleted}`
          );
        }
      } catch (err) {
        console.error("Error reading project data:", err);
      }

      // Handle test migration updates
      if (projectIndex > -1 && isTest) {
        console.info("Updating test migration status");
        const project = ProjectModelLowdb.data.projects[projectIndex];

        // Initialize test_stacks if needed
        if (!project.test_stacks) {
          project.test_stacks = [];
        }

        // Update migration status for the specific stack
        project.test_stacks.forEach((item: TestStack) => {
          if (item.stackUid === stack_uid) {
            item.isMigrated = true;
          }
        });

        await ProjectModelLowdb.write();
      }

      // Update project status for non-test migrations
      if (projectIndex > -1 && !isTest) {
        // Direct modification might be more reliable
        ProjectModelLowdb.data.projects[projectIndex].isMigrationCompleted =
          true;
        ProjectModelLowdb.data.projects[projectIndex].isMigrationStarted =
          false;
        ProjectModelLowdb.data.projects[projectIndex].current_step = 5;
        ProjectModelLowdb.data.projects[projectIndex].status = 5;
        await ProjectModelLowdb.write();
        console.info(
          `Project ${projectId} status updated: migration completed`
        );
      }
    } else {
      console.info("User not found.");
    }
  } catch (error) {
    console.error("🚀 ~ runCli ~ error:", error);
  }
};

export const utilsCli = { runCli };
