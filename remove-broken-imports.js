const fs = require('fs');
const path = require('path');

const exts = ['.js', '.ts', '.tsx'];
const targetDirs = ['api', 'ui', 'upload-api'];

function resolveImport(importPath, fileDir) {
  let basePath = path.resolve(fileDir, importPath);

  // 1. Direct file with extension
  if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
    return true;
  }

  // 2. Try with extensions
  for (const ext of exts) {
    if (fs.existsSync(basePath + ext)) {
      return true;
    }
  }

  // 3. Directory with index file
  if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
    for (const ext of exts) {
      if (fs.existsSync(path.join(basePath, 'index' + ext))) {
        return true;
      }
    }
  }

  return false;
}

function cleanImportsInFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf-8');
  const fileDir = path.dirname(filePath);

  const importRegex = /^import\s+(type\s+)?[\s\S]*?from\s+['"](.*?)['"];?.*$/gm;

  let changed = false;
  code = code.replace(importRegex, (match, typeKeyword, importPath) => {
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) return match;

    if (!resolveImport(importPath, fileDir)) {
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
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(dirent => {
    const entry = path.join(dir, dirent.name);
    if (
      dirent.isDirectory() &&
      dirent.name !== 'node_modules' &&
      !dirent.name.startsWith('.')
    ) {
      walkDir(entry, callback);
    } else if (
      dirent.isFile() &&
      exts.some(ext => entry.endsWith(ext))
    ) {
      callback(entry);
    }
  });
}

// Only process the specified folders
targetDirs.forEach(folder => {
  const absPath = path.join(process.cwd(), folder);
  walkDir(absPath, cleanImportsInFile);
});
