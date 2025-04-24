const fs = require('fs');
const path = require('path');

const exts = ['.js', '.ts', '.tsx'];
const targetDirs = ['api', 'ui', 'upload-api'];

function resolveImport(importPath, fileDir) {
  // Absolute or relative path
  let basePath = path.resolve(fileDir, importPath);

  // 1. If import has extension, check directly
  if (/\.[jt]sx?$/.test(importPath)) {
    if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
      return true;
    }
  } else {
    // 2. Try with extensions
    for (const ext of exts) {
      if (fs.existsSync(basePath + ext) && fs.statSync(basePath + ext).isFile()) {
        return true;
      }
    }
    // 3. Directory with index file
    if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
      for (const ext of exts) {
        const idx = path.join(basePath, 'index' + ext);
        if (fs.existsSync(idx) && fs.statSync(idx).isFile()) {
          return true;
        }
      }
    }
  }
  return false;
}

function cleanImportsInFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf-8');
  const fileDir = path.dirname(filePath);

  // Handles both regular and type-only imports
  const importRegex = /^import\s+(type\s+)?[\s\S]*?from\s+['"](.*?)['"];?.*$/gm;

  let changed = false;
  code = code.replace(importRegex, (match, typeKeyword, importPath) => {
    // Ignore node_modules and built-in modules
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
