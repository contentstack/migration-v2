interface ZipEntry {
  dir: boolean;
  async(
    type: 'string' | 'arraybuffer' | 'uint8array' | 'blob' | 'nodebuffer' | 'base64'
  ): Promise<any>;
}

interface JSZipFiles {
  [fileName: string]: ZipEntry;
}

interface ValidatorProps {
  data: {
    files: JSZipFiles;
  };
}

async function aemValidator({ data }: ValidatorProps) {
  try {
    const fileNames = Object.keys(data?.files);
    const test = 'jcr:content';

    for (const fileName of fileNames) {
      const file: any = data?.files?.[fileName];
      if (!file?.dir) {
        const content = await file.async('string');
        if (`content.${test}.root`) {
          return true;
        }
      } else {
        return false;
      }
    }
  } catch (err) {
    console.info('Error : ', err);
  }
}

export default aemValidator;
