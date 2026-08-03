import axios from "axios";

/**
 * Downloads a real asset's binary bytes from its (CDN) URL — so an export's
 * `assets/files/<uid>/<filename>` holds the actual downloaded file, not just
 * a metadata pointer to an external link.
 */
export const downloadAssetBinary = async (url: string): Promise<Buffer> => {
  const res = await axios.get(url, { responseType: "arraybuffer", timeout: 60_000 });
  return Buffer.from(res.data);
};
