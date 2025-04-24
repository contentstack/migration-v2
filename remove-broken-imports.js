const fs = require('fs');
const path = require('path');

const exts = ['.js', '.ts', '.tsx'];

function fileExists(importPath, fileDir) {
  for (const ext of exts) {
    let resolved = path.resolve(fileDir, importPath);
    if (!resolved.endsWith(ext)) resolved += ext;
    if (fs.existsSync(resolved)) return true;
  }
  return false;
}

function cleanImportsInFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf-8');
  const fileDir = path.dirname(filePath);
  const importRegex = /import\s+.*?from\s+['"](.*?)['"];?/g;

  let changed = false;
  code = code.replace(importRegex, (match, importPath) => {
    // Ignore node_modules and built-in modules
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) return match;

    if (!fileExists(importPath, fileDir)) {
      console.log(`Removing broken import in ${filePath}: ${match.trim()}`);
      changed = true;
      return '';
    }
    return match;
  });

  if (changed) {
    fs.writeFileSync(filePath, code);
  }
}

function walkDir(dir, callback) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(dirent => {
    const entry = path.join(dir, dirent.name);
    if (dirent.isDirectory() && dir !== 'node_modules' && !dirent.name.startsWith('.')) {
      walkDir(entry, callback);
    } else if (
      dirent.isFile() &&
      exts.some(ext => entry.endsWith(ext))
    ) {
      callback(entry);
    }
  });
}

// Start from the repo root
walkDir(process.cwd(), cleanImportsInFile);
