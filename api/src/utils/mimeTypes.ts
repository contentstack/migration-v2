/**
 * Mapping of file extensions to MIME types.
 * Use `getMimeTypeFromExtension()` to resolve a MIME type for a given extension.
 */

export const EXT_TO_MIME_MAP: Record<string, string> = {
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
 * Return the MIME type for a given file extension, or `undefined` if unknown.
 */
export function getMimeTypeFromExtension(ext: string): string | undefined {
  return EXT_TO_MIME_MAP[ext?.toLowerCase()];
}

export default EXT_TO_MIME_MAP;
