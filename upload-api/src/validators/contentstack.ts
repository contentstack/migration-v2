import JSZip from 'jszip';

const contentstackValidator = async ({ data, extension }: { data: any; extension: string }) => {
  switch (extension) {
    case 'zip': {
      const zip = data as JSZip;
      const files = Object.keys(zip?.files || {});
      const hasSchema = files.some((file) => file.includes('content_types/schema.json'));
      const hasExportInfo = files.some((file) => file.endsWith('export-info.json'));
      return hasSchema && hasExportInfo;
    }
    case 'json': {
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        return parsed && (Array.isArray(parsed) || typeof parsed === 'object');
      } catch (error) {
        return false;
      }
    }
    default:
      return false;
  }
};

export default contentstackValidator;

