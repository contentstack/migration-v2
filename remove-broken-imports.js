const fs = require('fs');
const path = require('path');

const exts = ['.js', '.ts', '.tsx'];
const targetDirs = ['api','ui','upload-api'];

function resolveImport(importPath, fileDir) {
  const absPath = path.resolve(fileDir, importPath);

  // 1. Check as-is (could be a file with or without extension)
  if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
    return true;
  }

  // 2. If import has extension, check for aliasing (.js <-> .ts, .jsx <-> .tsx)
  const extMatch = importPath.match(/\.(js|jsx)$/);
  if (extMatch) {
    const tsLike = extMatch[1] === 'js'
      ? importPath.replace(/\.js$/, '.ts')
      : importPath.replace(/\.jsx$/, '.tsx');
    const tsLikePath = path.resolve(fileDir, tsLike);
    if (fs.existsSync(tsLikePath) && fs.statSync(tsLikePath).isFile()) {
      return true;
    }
  }

  // 3. Try with extensions
  for (const ext of exts) {
    const withExt = absPath + ext;
    if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
      return true;
    }
  }

  // 4. Directory with index file
  if (fs.existsSync(absPath) && fs.statSync(absPath).isDirectory()) {
    for (const ext of exts) {
      const idx = path.join(absPath, 'index' + ext);
      if (fs.existsSync(idx) && fs.statSync(idx).isFile()) {
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

targetDirs.forEach(folder => {
  const absPath = path.join(process.cwd(), folder);
  walkDir(absPath, cleanImportsInFile);
});
