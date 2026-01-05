/*
coremedia Validator
*/

async function coremediaValidator({ data }: any): Promise<boolean> {
  try {
    const nestedZipFiles: string[] = [];

    for (const filename of Object.keys(data?.files)) {
      // Check for nested zip files
      if (filename.toLowerCase().endsWith('.zip')) {
        nestedZipFiles.push(filename);
        continue;
      }
    }
    return true;
  } catch (err) {
    console.info('🚀 ~ coremediaValidator ~ err:', err);
    return false;
  }
}

export default coremediaValidator;

