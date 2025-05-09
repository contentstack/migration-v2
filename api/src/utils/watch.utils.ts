import fs from 'fs';
import chokidar from 'chokidar';

// Function to merge logs from source to destination
const mergeLogs = async (destinationFile: string, sourceFile: string) => {
  try {
    const transformeLogs = await fs.promises.readFile(sourceFile, 'utf8');
    const logMessage = transformeLogs + '\n'; // Append a newline after the log content
    await fs.promises.appendFile(destinationFile, logMessage);
    console.info(`Merged logs from ${sourceFile} to ${destinationFile}`);
  } catch (error: any) {
    console.error(`Error merging logs: ${error.message}`);
  }
};

// Function to watch the log file
const watchLogs = async (sourceFile: string, destinationFile: string) => {
  // Initialize watcher
  const watcher = chokidar.watch(sourceFile, {
    persistent: true,
    ignoreInitial: true, // Do not trigger on the existing state
    awaitWriteFinish: {
      stabilityThreshold: 100, // Wait 1 millisecond before triggering (for fast writes)
      pollInterval: 100 // Check for changes every 1 ms
    },
  });
  // Event listener for file changes
  watcher.on('change', async (path: string) => {
    console.info(`File ${path} has been changed`);
    // Update the destination file when the source file changes
    await mergeLogs(destinationFile, sourceFile); // Await the mergeLogs function
  });
  // Handle errors
  watcher.on('error', (error) => {
    console.error(`Watcher error: ${error}`);
  });
};

export default watchLogs;