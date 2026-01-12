/**
 * Mapping of common MIME types to file extensions.
 * Use `getExtension()` to resolve an extension for a given MIME type.
 */

export const MIME_TYPE_EXT_MAP: Record<string, string> = {
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp' : 'image/webp',
  'svg': 'image/svg+xml',
  'ico': 'image/x-icon', // or 'image/vnd.microsoft.icon'
  'mp4': 'video/mp4',
  'webm': 'video/webm',
  'mov': 'video/quicktime',
  'avi': 'video/x-msvideo',
  'mp3': 'audio/mpeg',
  'm4a': 'audio/mp4',
  'wav': 'audio/wav',
  'ogg': 'audio/ogg',
  'pdf': 'application/pdf',
  'zip': 'application/zip',
  'json': 'application/json',
  'txt': 'text/plain',
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'xls': 'application/vnd.ms-excel',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'ppt': 'application/vnd.ms-powerpoint',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'


};

/**
 * Return the file extension for a given MIME type, or `undefined` if unknown.
 */
export function getExtension(mimeType: string): string  {
  //if (!mimeType) return undefined;
  return MIME_TYPE_EXT_MAP[mimeType.toLowerCase()];
}

export default MIME_TYPE_EXT_MAP;
